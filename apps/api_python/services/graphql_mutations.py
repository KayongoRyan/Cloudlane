from __future__ import annotations

import re
import secrets
from typing import Any

from fastapi import HTTPException
from graphql import GraphQLError

import database as db
from auth import AuthContext, client_ip, require_scopes
from config import get_settings
from routes.load_balancers import _sync_configs as sync_lb_configs
from routes.load_balancers import _validate_tcp_port
from services.database_backup import create_backup, presigned_download_url
from services.providers import (
    get_database_provider,
    get_load_balancer_provider,
    get_object_storage_provider,
    get_secret_vault_provider,
)
from services.providers.database import ManagedDatabaseError
from services.quota import (
    assert_bucket_allowed,
    assert_database_allowed,
    assert_deployment_allowed,
    assert_load_balancer_allowed,
    assert_secret_allowed,
)
from services.sql_disk import refresh_disk_usage


def _gql_error(exc: HTTPException) -> GraphQLError:
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return GraphQLError(detail, extensions={'code': exc.status_code})


def _require_deploy(auth: AuthContext) -> None:
    try:
        require_scopes(auth, 'deploy')
    except HTTPException as exc:
        raise _gql_error(exc) from exc


def _audit(auth: AuthContext, request, action: str, resource_type: str, resource_id: str, changes: dict | None = None) -> None:
    db.write_audit_log({
        'tenantId': auth.tenant_id,
        'userId': auth.user_id,
        'action': action,
        'resourceType': resource_type,
        'resourceId': resource_id,
        'changes': changes or {},
        'ipAddress': client_ip(request) if request else None,
    })


def gql_mutation(fn):
    def wrapped(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except HTTPException as exc:
            raise _gql_error(exc) from exc
        except GraphQLError:
            raise
        except ManagedDatabaseError as exc:
            raise GraphQLError(str(exc)) from exc
    wrapped.__name__ = fn.__name__
    return wrapped


def _resolve_project(auth: AuthContext, project_id: str | None) -> dict:
    project = db.get_or_create_default_project(auth.tenant_id)
    if project_id:
        found = db.find_project_by_id(project_id, auth.tenant_id)
        if not found:
            raise GraphQLError('Project not found')
        project = found
    return project


@gql_mutation
def mutation_create_project(auth: AuthContext, request, name: str) -> dict:
    _require_deploy(auth)
    slug = re.sub(r'[^a-z0-9-]', '', name, flags=re.I).lower() or 'project'
    try:
        project = db.create_project(auth.tenant_id, name.strip(), slug)
    except Exception as exc:
        if getattr(exc, 'code', None) == 11000:
            raise GraphQLError('Project slug already exists') from exc
        raise
    _audit(auth, request, 'project.create', 'project', project['id'])
    return project


@gql_mutation
def mutation_create_deployment(
    auth: AuthContext,
    request,
    *,
    name: str,
    image: str,
    port: int,
    project_id: str | None = None,
    cpu: float | None = None,
    memory: int | None = None,
    min_instances: int | None = None,
    max_instances: int | None = None,
) -> tuple[dict, str]:
    _require_deploy(auth)
    settings = get_settings()
    if not db.find_tenant(auth.tenant_id):
        raise GraphQLError('Tenant not found')

    min_i = min_instances if min_instances is not None else 0
    max_i = max_instances if max_instances is not None else 3
    cpu_v = cpu if cpu is not None else 0.5
    memory_v = memory if memory is not None else 256
    assert_deployment_allowed(auth.tenant_id, cpu_v, memory_v, max_i)

    project = _resolve_project(auth, project_id)
    slug = re.sub(r'[^a-z0-9-]', '', name, flags=re.I).lower() or 'app'
    host = f'{slug}-{secrets.token_hex(3)}'
    public_url = f'https://{host}.{settings.base_domain}'
    k8s_namespace = f'tenant-{auth.tenant_id}'[:63]
    deployment_name = name.replace(' ', '-').lower()

    deployment = db.create_deployment({
        'tenantId': auth.tenant_id,
        'projectId': project['id'],
        'name': deployment_name,
        'slug': slug,
        'image': image,
        'cpu': cpu_v,
        'memory': memory_v,
        'minInstances': min_i,
        'maxInstances': max_i,
        'status': 'provisioning',
        'statusMessage': 'Queued for provisioning',
        'publicUrl': public_url,
        'k8sNamespace': k8s_namespace,
        'port': port,
    })
    job = db.create_provision_job({
        'tenantId': auth.tenant_id,
        'deploymentId': deployment['id'],
        'type': 'deployment.create',
        'payload': {
            'deploymentName': deployment_name,
            'image': image,
            'port': port,
            'k8sNamespace': k8s_namespace,
            'host': host,
            'minInstances': min_i,
            'maxInstances': max_i,
            'cpu': cpu_v,
        },
    })
    _audit(auth, request, 'deployment.create', 'deployment', deployment['id'], {
        'name': deployment_name,
        'image': image,
        'publicUrl': public_url,
        'jobId': job['id'],
    })
    return deployment, job['id']


@gql_mutation
def mutation_delete_deployment(auth: AuthContext, request, deployment_id: str) -> bool:
    _require_deploy(auth)
    existing = db.find_deployment_by_id(deployment_id, auth.tenant_id)
    if not existing:
        raise GraphQLError('Deployment not found')
    if not db.soft_delete_deployment(deployment_id, auth.tenant_id):
        raise GraphQLError('Deployment not found')
    try:
        from services.providers import get_compute_provider
        compute = get_compute_provider()
        ns = existing.get('k8sNamespace')
        name = existing.get('name')
        if compute.is_ready() and ns and name:
            compute.delete_scaled_objects(ns, name)
    except Exception as exc:
        print(f'keda cleanup on delete failed: {exc}')
    _audit(auth, request, 'deployment.delete', 'deployment', deployment_id)
    return True


@gql_mutation
def mutation_create_bucket(auth: AuthContext, request, name: str, project_id: str | None = None) -> dict:
    _require_deploy(auth)
    assert_bucket_allowed(auth.tenant_id)
    project = _resolve_project(auth, project_id)
    bucket_name = name.strip().lower()
    if db.find_bucket_by_name(bucket_name, auth.tenant_id):
        raise GraphQLError('Bucket already exists')
    storage = get_object_storage_provider()
    storage.ensure_bucket(bucket_name)
    bucket = db.create_bucket(auth.tenant_id, project['id'], bucket_name)
    _audit(auth, request, 'bucket.create', 'bucket', bucket['id'])
    return bucket


@gql_mutation
def mutation_create_secret(
    auth: AuthContext,
    request,
    name: str,
    value: str,
    project_id: str | None = None,
) -> dict:
    _require_deploy(auth)
    assert_secret_allowed(auth.tenant_id)
    secret_name = name.strip()
    if db.find_secret_by_name(secret_name, auth.tenant_id):
        raise GraphQLError('Secret already exists')
    project = _resolve_project(auth, project_id)
    vault = get_secret_vault_provider()
    secret = db.create_secret({
        'tenantId': auth.tenant_id,
        'projectId': project['id'],
        'name': secret_name,
        'ciphertext': vault.seal(value),
    })
    _audit(auth, request, 'secret.create', 'secret', secret['id'], {'name': secret_name})
    return secret


@gql_mutation
def mutation_rotate_secret(auth: AuthContext, request, secret_id: str, value: str) -> dict:
    _require_deploy(auth)
    vault = get_secret_vault_provider()
    secret = db.update_secret_value(secret_id, auth.tenant_id, vault.seal(value))
    if not secret:
        raise GraphQLError('Secret not found')
    _audit(auth, request, 'secret.rotate', 'secret', secret['id'], {'version': secret['version']})
    return secret


@gql_mutation
def mutation_delete_secret(auth: AuthContext, request, secret_id: str) -> bool:
    _require_deploy(auth)
    if not db.delete_secret(secret_id, auth.tenant_id):
        raise GraphQLError('Secret not found')
    _audit(auth, request, 'secret.delete', 'secret', secret_id)
    return True


@gql_mutation
def mutation_create_load_balancer(
    auth: AuthContext,
    request,
    *,
    name: str,
    protocol: str = 'HTTP',
    port: int = 80,
    scheme: str = 'internet-facing',
    target_deployment_id: str | None = None,
    project_id: str | None = None,
) -> dict:
    _require_deploy(auth)
    assert_load_balancer_allowed(auth.tenant_id)
    project = _resolve_project(auth, project_id)
    if target_deployment_id:
        dep = db.find_deployment_by_id(target_deployment_id, auth.tenant_id)
        if not dep:
            raise GraphQLError('Target deployment not found')
    proto = (protocol or 'HTTP').upper()
    if proto == 'TCP':
        _validate_tcp_port(port)
    lb_name = name.replace(' ', '-').lower()
    provisioned = get_load_balancer_provider().provision(lb_name, scheme, protocol, port)
    lb = db.create_load_balancer({
        'tenantId': auth.tenant_id,
        'projectId': project['id'],
        'name': lb_name,
        'scheme': scheme,
        'protocol': protocol,
        'port': port,
        'targetDeploymentId': target_deployment_id,
        'dnsName': provisioned['dnsName'],
        'status': provisioned['status'],
        'statusMessage': provisioned['statusMessage'],
    })
    _audit(auth, request, 'load_balancer.create', 'load_balancer', lb['id'], {
        'name': lb_name,
        'dnsName': lb.get('dnsName'),
    })
    sync_lb_configs()
    return lb


@gql_mutation
def mutation_update_load_balancer(
    auth: AuthContext,
    request,
    lb_id: str,
    *,
    name: str | None = None,
    status: str | None = None,
    port: int | None = None,
    target_deployment_id: str | None = None,
) -> dict:
    _require_deploy(auth)
    updates: dict[str, Any] = {}
    if name is not None:
        updates['name'] = name
    if status is not None:
        updates['status'] = status
    if port is not None:
        updates['port'] = port
    if target_deployment_id is not None:
        updates['targetDeploymentId'] = target_deployment_id
    if target_deployment_id:
        dep = db.find_deployment_by_id(target_deployment_id, auth.tenant_id)
        if not dep:
            raise GraphQLError('Target deployment not found')
    if port is not None:
        existing = db.find_load_balancer_by_id(lb_id, auth.tenant_id)
        if not existing:
            raise GraphQLError('Load balancer not found')
        if (existing.get('protocol') or 'HTTP').upper() == 'TCP':
            _validate_tcp_port(port, exclude_lb_id=lb_id)
    lb = db.update_load_balancer(lb_id, auth.tenant_id, updates)
    if not lb:
        raise GraphQLError('Load balancer not found')
    sync_lb_configs()
    return lb


@gql_mutation
def mutation_delete_load_balancer(auth: AuthContext, request, lb_id: str) -> bool:
    _require_deploy(auth)
    if not db.delete_load_balancer(lb_id, auth.tenant_id):
        raise GraphQLError('Load balancer not found')
    _audit(auth, request, 'load_balancer.delete', 'load_balancer', lb_id)
    sync_lb_configs()
    return True


@gql_mutation
def mutation_create_database(
    auth: AuthContext,
    request,
    *,
    name: str,
    engine: str = 'postgres',
    version: str = '16',
    size_gb: int = 10,
    dedicated: bool = False,
    auto_backup: bool = True,
    project_id: str | None = None,
) -> dict:
    _require_deploy(auth)
    assert_database_allowed(auth.tenant_id, additional_storage_gb=size_gb)
    project = _resolve_project(auth, project_id)
    db_name = name.replace(' ', '-').lower()
    provider = get_database_provider()
    if not dedicated and not provider.is_engine_ready(engine):
        raise GraphQLError(
            f'Managed {engine} engine is not running — start docker compose managed-{engine}'
        )
    placeholder = db.create_database_instance({
        'tenantId': auth.tenant_id,
        'projectId': project['id'],
        'name': db_name,
        'engine': engine,
        'version': version,
        'sizeGb': size_gb,
        'dedicated': dedicated,
        'autoBackup': auto_backup,
        'status': 'provisioning',
        'statusMessage': 'Provisioning database resources',
    })
    try:
        provisioned = provider.provision(
            db_name,
            engine,
            version,
            size_gb,
            tenant_id=auth.tenant_id,
            dedicated=dedicated,
            instance_id=placeholder['id'],
        )
    except ManagedDatabaseError as exc:
        db.delete_database_instance(placeholder['id'], auth.tenant_id)
        raise GraphQLError(str(exc)) from exc
    instance = db.update_database_instance(placeholder['id'], auth.tenant_id, {
        **provisioned,
        'status': 'available',
    })
    if not instance:
        raise GraphQLError('Failed to finalize database instance')
    refresh_disk_usage(instance)
    instance = db.find_database_instance_by_id(instance['id'], auth.tenant_id, include_connection=True)
    _audit(auth, request, 'database.create', 'database_instance', instance['id'], {
        'name': db_name,
        'engine': engine,
        'dedicated': dedicated,
    })
    return instance


@gql_mutation
def mutation_update_database(
    auth: AuthContext,
    instance_id: str,
    *,
    size_gb: int | None = None,
    auto_backup: bool | None = None,
    status: str | None = None,
) -> dict:
    _require_deploy(auth)
    updates: dict[str, Any] = {}
    if size_gb is not None:
        updates['sizeGb'] = size_gb
    if auto_backup is not None:
        updates['autoBackup'] = auto_backup
    if status is not None:
        updates['status'] = status
    if size_gb is not None:
        existing = db.find_database_instance_by_id(instance_id, auth.tenant_id)
        if not existing:
            raise GraphQLError('Database instance not found')
        delta = size_gb - int(existing.get('sizeGb', 0))
        if delta > 0:
            assert_database_allowed(auth.tenant_id, additional_storage_gb=delta)
    instance = db.update_database_instance(instance_id, auth.tenant_id, updates)
    if not instance:
        raise GraphQLError('Database instance not found')
    return instance


@gql_mutation
def mutation_delete_database(auth: AuthContext, request, instance_id: str) -> bool:
    _require_deploy(auth)
    existing = db.find_database_instance_by_id(instance_id, auth.tenant_id)
    if not existing:
        raise GraphQLError('Database instance not found')
    db_name = existing.get('dbName')
    username = existing.get('username')
    if db_name and username:
        get_database_provider().deprovision(
            engine=existing.get('engine', 'postgres'),
            db_name=db_name,
            username=username,
            instance=existing,
        )
    db.delete_database_instance(instance_id, auth.tenant_id)
    _audit(auth, request, 'database.delete', 'database_instance', instance_id)
    return True


@gql_mutation
def mutation_create_database_backup(auth: AuthContext, request, instance_id: str) -> dict:
    _require_deploy(auth)
    instance = db.find_database_instance_by_id(instance_id, auth.tenant_id)
    if not instance:
        raise GraphQLError('Database instance not found')
    backup = create_backup(instance, trigger='manual')
    _audit(auth, request, 'database.backup.create', 'database_backup', backup['id'], {
        'instanceId': instance_id,
    })
    download_url = presigned_download_url(backup)
    return {**backup, 'downloadUrl': download_url}
