from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from bson import ObjectId
from pymongo import MongoClient, ReturnDocument
from pymongo.collection import Collection
from pymongo.database import Database

from config import get_settings

# Free-tier defaults must fit at least one default deploy (0.5 vCPU × 3 instances, 256 MB × 3).
DEFAULT_TENANT_LIMITS = {
    'maxDeployments': 8,
    'maxCpu': 4,
    'maxMemoryMb': 4096,
    'maxInstances': 3,
    'maxBuckets': 5,
    'maxSecrets': 50,
    'maxLoadBalancers': 5,
    'maxDatabaseInstances': 3,
}

_client: MongoClient | None = None
_db: Database | None = None


def to_direct_mongo_url(url: str) -> str:
    if not url.startswith('mongodb+srv://'):
        return url
    try:
        parsed = urlparse(url.replace('mongodb+srv://', 'https://'))
        user = parsed.username or ''
        password = parsed.password or ''
        db_name = parsed.path.lstrip('/') or 'cloudlane'
        if not parsed.hostname or not parsed.hostname.endswith('3dn8fdi.mongodb.net'):
            return url
        hosts = ','.join([
            'ac-eqdfsxk-shard-00-00.3dn8fdi.mongodb.net:27017',
            'ac-eqdfsxk-shard-00-01.3dn8fdi.mongodb.net:27017',
            'ac-eqdfsxk-shard-00-02.3dn8fdi.mongodb.net:27017',
        ])
        return (
            f'mongodb://{user}:{password}@{hosts}/{db_name}'
            f'?ssl=true&retryWrites=true&w=majority&authSource=admin'
        )
    except Exception:
        return url


def is_object_id_string(value: str) -> bool:
    return ObjectId.is_valid(value) and str(ObjectId(value)) == value


def as_object_id(value: str) -> ObjectId:
    return ObjectId(value)


def oid_or_raw(value: str) -> ObjectId | str:
    return as_object_id(value) if is_object_id_string(value) else value


def tenant_clause(tenant_id: str) -> dict[str, Any]:
    vals: list[ObjectId | str] = [tenant_id]
    if is_object_id_string(tenant_id):
        vals.append(as_object_id(tenant_id))
    return {'tenantId': {'$in': vals}}


def ref_str(value: Any) -> str:
    if value is None:
        return ''
    if type(value).__name__ == 'ObjectId':
        try:
            return value.binary.hex()
        except AttributeError:
            return str(value)
    return str(value)


def map_limits(raw: Any) -> dict[str, int]:
    data = raw if isinstance(raw, dict) else {}
    return {
        'maxDeployments': data.get('maxDeployments', DEFAULT_TENANT_LIMITS['maxDeployments']),
        'maxCpu': data.get('maxCpu', DEFAULT_TENANT_LIMITS['maxCpu']),
        'maxMemoryMb': data.get('maxMemoryMb', DEFAULT_TENANT_LIMITS['maxMemoryMb']),
        'maxInstances': data.get('maxInstances', DEFAULT_TENANT_LIMITS['maxInstances']),
        'maxBuckets': data.get('maxBuckets', DEFAULT_TENANT_LIMITS['maxBuckets']),
        'maxSecrets': data.get('maxSecrets', DEFAULT_TENANT_LIMITS['maxSecrets']),
        'maxLoadBalancers': data.get('maxLoadBalancers', DEFAULT_TENANT_LIMITS['maxLoadBalancers']),
        'maxDatabaseInstances': data.get(
            'maxDatabaseInstances',
            DEFAULT_TENANT_LIMITS['maxDatabaseInstances'],
        ),
    }


def map_tenant(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': ref_str(doc['_id']),
        'slug': doc['slug'],
        'name': doc['name'],
        'status': doc['status'],
        'tier': doc['tier'],
        'limits': map_limits(doc.get('limits')),
        'irembopayCustomerId': doc.get('irembopayCustomerId'),
        'createdAt': doc.get('createdAt'),
    }


def map_user(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': ref_str(doc['_id']),
        'tenantId': ref_str(doc['tenantId']),
        'email': doc['email'],
        'passwordHash': doc['passwordHash'],
        'role': doc['role'],
        'status': doc.get('status', 'active'),
        'createdAt': doc.get('createdAt'),
    }


def map_deployment(doc: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    slug = doc.get('slug') or doc.get('name', '')
    public_url = doc.get('publicUrl')
    if not public_url and doc.get('subdomain'):
        public_url = f"https://{doc['subdomain']}.{settings.base_domain}"
    return {
        'id': ref_str(doc['_id']),
        'tenantId': ref_str(doc['tenantId']),
        'name': doc['name'],
        'slug': slug,
        'image': doc['image'],
        'cpu': doc.get('cpu', 0.5),
        'memory': doc.get('memory', 256),
        'minInstances': doc.get('minInstances', doc.get('minReplicas', 0)),
        'maxInstances': doc.get('maxInstances', doc.get('maxReplicas', 3)),
        'status': doc['status'],
        'statusMessage': doc.get('statusMessage'),
        'publicUrl': public_url or '',
        'k8sNamespace': doc.get('k8sNamespace') or doc.get('kubernetesNamespace', ''),
        'port': doc.get('port', 8080),
        'projectId': ref_str(doc['projectId']) if doc.get('projectId') else None,
        'deletedAt': doc.get('deletedAt'),
        'createdAt': doc.get('createdAt'),
    }


def map_project(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': ref_str(doc['_id']),
        'tenantId': ref_str(doc['tenantId']),
        'name': doc['name'],
        'slug': doc['slug'],
        'createdAt': doc.get('createdAt'),
    }


def map_bucket(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': ref_str(doc['_id']),
        'tenantId': ref_str(doc['tenantId']),
        'projectId': ref_str(doc['projectId']) if doc.get('projectId') else None,
        'name': doc['name'],
        'createdAt': doc.get('createdAt'),
    }


def map_invoice(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': ref_str(doc['_id']),
        'tenantId': ref_str(doc['tenantId']),
        'periodStart': doc['periodStart'],
        'periodEnd': doc['periodEnd'],
        'totalAmount': doc['totalAmount'],
        'currency': doc.get('currency', 'RWF'),
        'status': doc['status'],
        'irembopayTransactionId': doc.get('irembopayTransactionId'),
        'breakdown': doc.get('breakdown') or {},
        'createdAt': doc.get('createdAt'),
    }


def map_vm(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': ref_str(doc['_id']),
        'tenantId': ref_str(doc['tenantId']),
        'projectId': ref_str(doc['projectId']) if doc.get('projectId') else None,
        'name': doc['name'],
        'cpu': doc.get('cpu', 1),
        'memoryMb': doc.get('memoryMb', 512),
        'status': doc['status'],
        'publicIp': doc.get('publicIp'),
        'createdAt': doc.get('createdAt'),
    }


def map_secret(doc: dict[str, Any], *, include_value: bool = False) -> dict[str, Any]:
    out = {
        'id': ref_str(doc['_id']),
        'tenantId': ref_str(doc['tenantId']),
        'projectId': ref_str(doc['projectId']) if doc.get('projectId') else None,
        'name': doc['name'],
        'version': doc.get('version', 1),
        'createdAt': doc.get('createdAt'),
        'updatedAt': doc.get('updatedAt'),
    }
    if include_value and doc.get('ciphertext'):
        from services.secrets_crypto import decrypt_secret
        out['value'] = decrypt_secret(doc['ciphertext'])
    return out


def map_system_secret(doc: dict[str, Any], *, include_value: bool = False) -> dict[str, Any]:
    out = {
        'id': ref_str(doc['_id']),
        'name': doc['name'],
        'version': doc.get('version', 1),
        'createdAt': doc.get('createdAt'),
        'updatedAt': doc.get('updatedAt'),
    }
    if include_value and doc.get('ciphertext'):
        from services.secrets_crypto import decrypt_secret
        out['value'] = decrypt_secret(doc['ciphertext'])
    return out


def map_load_balancer(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': ref_str(doc['_id']),
        'tenantId': ref_str(doc['tenantId']),
        'projectId': ref_str(doc['projectId']) if doc.get('projectId') else None,
        'name': doc['name'],
        'scheme': doc.get('scheme', 'internet-facing'),
        'protocol': doc.get('protocol', 'HTTP'),
        'port': doc.get('port', 80),
        'dnsName': doc.get('dnsName'),
        'targetDeploymentId': ref_str(doc['targetDeploymentId']) if doc.get('targetDeploymentId') else None,
        'status': doc.get('status', 'active'),
        'statusMessage': doc.get('statusMessage'),
        'createdAt': doc.get('createdAt'),
        'updatedAt': doc.get('updatedAt'),
    }


def map_database_instance(doc: dict[str, Any], *, include_connection: bool = False) -> dict[str, Any]:
    out = {
        'id': ref_str(doc['_id']),
        'tenantId': ref_str(doc['tenantId']),
        'projectId': ref_str(doc['projectId']) if doc.get('projectId') else None,
        'name': doc['name'],
        'engine': doc.get('engine', 'postgres'),
        'version': doc.get('version', '16'),
        'sizeGb': doc.get('sizeGb', 10),
        'host': doc.get('host'),
        'port': doc.get('port'),
        'endpoint': doc.get('endpoint'),
        'username': doc.get('username'),
        'status': doc.get('status', 'available'),
        'statusMessage': doc.get('statusMessage'),
        'createdAt': doc.get('createdAt'),
        'updatedAt': doc.get('updatedAt'),
    }
    if include_connection:
        out['connectionString'] = doc.get('connectionString')
    return out


def map_api_key(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': ref_str(doc['_id']),
        'tenantId': ref_str(doc['tenantId']),
        'userId': ref_str(doc['userId']),
        'name': doc.get('name', 'default'),
        'prefix': doc['prefix'],
        'scopes': doc.get('scopes') or ['deploy', 'read'],
        'expiresAt': doc.get('expiresAt'),
        'lastUsedAt': doc.get('lastUsedAt'),
    }


def map_audit_log(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': ref_str(doc['_id']),
        'tenantId': ref_str(doc['tenantId']),
        'userId': ref_str(doc['userId']) if doc.get('userId') else None,
        'action': doc['action'],
        'resourceType': doc['resourceType'],
        'resourceId': ref_str(doc['resourceId']) if doc.get('resourceId') else None,
        'changes': doc.get('changes') or {},
        'ipAddress': doc.get('ipAddress'),
        'createdAt': doc.get('createdAt'),
    }


def map_usage_metric(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': ref_str(doc['_id']),
        'tenantId': ref_str(doc['tenantId']),
        'deploymentId': ref_str(doc['deploymentId']) if doc.get('deploymentId') else None,
        'gatewayId': ref_str(doc['gatewayId']) if doc.get('gatewayId') else None,
        'metricType': doc['metricType'],
        'value': doc['value'],
        'windowStart': doc['windowStart'],
        'windowEnd': doc['windowEnd'],
    }


def map_gateway(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': ref_str(doc['_id']),
        'tenantId': ref_str(doc['tenantId']),
        'projectId': ref_str(doc['projectId']) if doc.get('projectId') else None,
        'name': doc['name'],
        'slug': doc['slug'],
        'status': doc.get('status', 'active'),
        'hostnames': doc.get('hostnames') or [],
        'defaultStage': doc.get('defaultStage', 'prod'),
        'createdAt': doc.get('createdAt'),
        'updatedAt': doc.get('updatedAt'),
    }


def map_gateway_route(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': ref_str(doc['_id']),
        'gatewayId': ref_str(doc['gatewayId']),
        'stage': doc.get('stage', 'prod'),
        'method': doc.get('method', 'GET').upper(),
        'path': doc['path'],
        'targetType': doc.get('targetType', 'deployment'),
        'targetDeploymentId': ref_str(doc['targetDeploymentId']) if doc.get('targetDeploymentId') else None,
        'stripPathPrefix': bool(doc.get('stripPathPrefix', False)),
        'timeoutMs': doc.get('timeoutMs', 30000),
        'createdAt': doc.get('createdAt'),
        'updatedAt': doc.get('updatedAt'),
    }


def map_gateway_key(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': ref_str(doc['_id']),
        'gatewayId': ref_str(doc['gatewayId']),
        'tenantId': ref_str(doc['tenantId']),
        'name': doc.get('name', 'default'),
        'prefix': doc['prefix'],
        'scopes': doc.get('scopes') or ['invoke'],
        'rateLimitRpm': doc.get('rateLimitRpm', 1000),
        'revokedAt': doc.get('revokedAt'),
        'lastUsedAt': doc.get('lastUsedAt'),
        'createdAt': doc.get('createdAt'),
    }


def map_provision_job(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': ref_str(doc['_id']),
        'tenantId': ref_str(doc['tenantId']),
        'deploymentId': ref_str(doc['deploymentId']),
        'type': doc.get('type', 'deployment.create'),
        'status': doc['status'],
        'payload': doc.get('payload') or {},
        'error': doc.get('error'),
        'attempts': doc.get('attempts', 0),
        'createdAt': doc.get('createdAt'),
        'updatedAt': doc.get('updatedAt'),
    }


def get_db() -> Database:
    global _client, _db
    if _db is not None:
        return _db
    settings = get_settings()
    from services.encryption import ensure_mongo_tls_params, mongo_url_uses_tls

    url = ensure_mongo_tls_params(to_direct_mongo_url(settings.database_url))
    if not url or not url.startswith('mongodb'):
        hint = (
            'Set DATABASE_URL in Netlify environment variables (MongoDB Atlas URI).'
            if settings.is_netlify
            else 'DATABASE_URL must be a mongodb:// or mongodb+srv:// URL.'
        )
        raise RuntimeError(hint)
    if settings.is_netlify and 'localhost' in url:
        raise RuntimeError('DATABASE_URL cannot point to localhost on Netlify. Use MongoDB Atlas.')
    if settings.require_mongo_tls and 'localhost' not in url and '127.0.0.1' not in url:
        if not mongo_url_uses_tls(url):
            raise RuntimeError(
                'Production requires TLS to MongoDB. Use mongodb+srv:// or append tls=true / ssl=true.'
            )
    _client = MongoClient(
        url,
        serverSelectionTimeoutMS=4000,
        connectTimeoutMS=4000,
        socketTimeoutMS=4000,
    )
    _db = _client.get_default_database()
    if _db is None:
        _db = _client['cloudlane']
    return _db


def col(name: str) -> Collection:
    return get_db()[name]


def ping_database() -> bool:
    try:
        get_db().command('ping')
        return True
    except Exception:
        return False


def ensure_indexes() -> None:
    if get_settings().is_netlify:
        return
    col('tenants').create_index('slug', unique=True)
    col('users').create_index('email', unique=True)
    col('users').create_index('tenantId')
    col('deployments').create_index('publicUrl', unique=True, sparse=True)
    col('deployments').create_index([('tenantId', 1), ('slug', 1)])
    col('deployments').create_index('tenantId')
    col('api_keys').create_index('prefix')
    col('api_keys').create_index('tenantId')
    col('api_keys').create_index('userId')
    col('audit_logs').create_index([('tenantId', 1), ('createdAt', -1)])
    col('usage_metrics').create_index([('tenantId', 1), ('deploymentId', 1), ('windowStart', -1)])
    col('projects').create_index([('tenantId', 1), ('slug', 1)], unique=True)
    col('buckets').create_index([('tenantId', 1), ('name', 1)], unique=True)
    col('invoices').create_index([('tenantId', 1), ('createdAt', -1)])
    col('vms').create_index([('tenantId', 1), ('name', 1)])
    col('secrets').create_index([('tenantId', 1), ('name', 1)], unique=True)
    col('system_secrets').create_index('name', unique=True)
    col('load_balancers').create_index([('tenantId', 1), ('name', 1)], unique=True)
    col('database_instances').create_index([('tenantId', 1), ('name', 1)], unique=True)
    col('gateways').create_index([('tenantId', 1), ('slug', 1)], unique=True)
    col('gateways').create_index('tenantId')
    col('gateways').create_index('projectId')
    col('gateway_routes').create_index(
        [('gatewayId', 1), ('stage', 1), ('method', 1), ('path', 1)],
        unique=True,
    )
    col('gateway_routes').create_index('gatewayId')
    col('gateway_keys').create_index('prefix')
    col('gateway_keys').create_index('gatewayId')
    col('gateway_keys').create_index('tenantId')
    col('provision_jobs').create_index([('status', 1), ('createdAt', 1)])
    col('provision_jobs').create_index('deploymentId')


def find_user_by_email(email: str) -> dict[str, Any] | None:
    doc = col('users').find_one({'email': email.lower()})
    return map_user(doc) if doc else None


def find_user_by_id_and_tenant(user_id: str, tenant_id: str) -> dict[str, Any] | None:
    users = col('users')
    if is_object_id_string(user_id):
        doc = users.find_one({'_id': as_object_id(user_id), **tenant_clause(tenant_id)})
        if doc:
            return map_user(doc)
    legacy = users.find_one({'id': user_id, **tenant_clause(tenant_id)})
    return map_user(legacy) if legacy else None


def create_user_and_tenant(name: str, slug: str, email: str, password_hash: str) -> dict[str, Any]:
    tenants = col('tenants')
    users = col('users')
    now = datetime.now(timezone.utc)
    tenant_result = tenants.insert_one({
        'slug': slug,
        'name': name,
        'status': 'active',
        'tier': 'free',
        'limits': dict(DEFAULT_TENANT_LIMITS),
        'irembopayCustomerId': None,
        'createdAt': now,
    })
    try:
        user_doc = {
            'tenantId': tenant_result.inserted_id,
            'email': email.lower(),
            'passwordHash': password_hash,
            'role': 'admin',
            'status': 'active',
            'createdAt': now,
        }
        user_result = users.insert_one(user_doc)
        user_doc['_id'] = user_result.inserted_id
        return map_user(user_doc)
    except Exception:
        tenants.delete_one({'_id': tenant_result.inserted_id})
        raise


def find_tenant(tenant_id: str) -> dict[str, Any] | None:
    if not is_object_id_string(tenant_id):
        return None
    doc = col('tenants').find_one({'_id': as_object_id(tenant_id)})
    return map_tenant(doc) if doc else None


def list_deployments(tenant_id: str) -> list[dict[str, Any]]:
    docs = col('deployments').find({
        **tenant_clause(tenant_id),
        '$or': [{'deletedAt': None}, {'deletedAt': {'$exists': False}}],
    }).sort('createdAt', -1)
    return [map_deployment(doc) for doc in docs]


def find_deployment_by_id(deployment_id: str, tenant_id: str) -> dict[str, Any] | None:
    if not is_object_id_string(deployment_id):
        return None
    doc = col('deployments').find_one({
        '_id': as_object_id(deployment_id),
        **tenant_clause(tenant_id),
        '$or': [{'deletedAt': None}, {'deletedAt': {'$exists': False}}],
    })
    return map_deployment(doc) if doc else None


def create_deployment(input_data: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {
        'tenantId': oid_or_raw(input_data['tenantId']),
        'name': input_data['name'],
        'slug': input_data['slug'],
        'image': input_data['image'],
        'cpu': input_data.get('cpu', 0.5),
        'memory': input_data.get('memory', 256),
        'minInstances': input_data.get('minInstances', 0),
        'maxInstances': input_data.get('maxInstances', 3),
        'status': input_data['status'],
        'statusMessage': input_data.get('statusMessage'),
        'publicUrl': input_data['publicUrl'],
        'k8sNamespace': input_data['k8sNamespace'],
        'port': input_data['port'],
        'projectId': oid_or_raw(input_data['projectId']) if input_data.get('projectId') else None,
        'deletedAt': None,
        'createdAt': now,
    }
    result = col('deployments').insert_one(doc)
    doc['_id'] = result.inserted_id
    return map_deployment(doc)


def update_deployment(deployment_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    if not is_object_id_string(deployment_id):
        raise ValueError('Deployment not found')
    doc = col('deployments').find_one_and_update(
        {'_id': as_object_id(deployment_id)},
        {'$set': updates},
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        raise ValueError('Deployment not found')
    return map_deployment(doc)


def update_deployment_status(deployment_id: str, status: str, status_message: str | None = None) -> dict[str, Any]:
    updates: dict[str, Any] = {'status': status}
    if status_message is not None:
        updates['statusMessage'] = status_message
    return update_deployment(deployment_id, updates)


def count_deployments(tenant_id: str) -> int:
    return col('deployments').count_documents({
        **tenant_clause(tenant_id),
        '$or': [{'deletedAt': None}, {'deletedAt': {'$exists': False}}],
    })


def count_buckets(tenant_id: str) -> int:
    return col('buckets').count_documents(tenant_clause(tenant_id))


def count_secrets(tenant_id: str) -> int:
    return col('secrets').count_documents(tenant_clause(tenant_id))


def count_load_balancers(tenant_id: str) -> int:
    return col('load_balancers').count_documents(tenant_clause(tenant_id))


def count_database_instances(tenant_id: str) -> int:
    return col('database_instances').count_documents(tenant_clause(tenant_id))


def summarize_tenant_usage(tenant_id: str) -> dict[str, int | float]:
    deployments = list_deployments(tenant_id)
    total_cpu = 0.0
    total_memory = 0
    total_max_instances = 0
    for deployment in deployments:
        instances = int(deployment.get('maxInstances') or 0)
        total_cpu += float(deployment.get('cpu') or 0) * instances
        total_memory += int(deployment.get('memory') or 0) * instances
        total_max_instances += instances
    return {
        'deployments': len(deployments),
        'totalCpu': round(total_cpu, 3),
        'totalMemoryMb': total_memory,
        'totalMaxInstances': total_max_instances,
        'buckets': count_buckets(tenant_id),
        'secrets': count_secrets(tenant_id),
        'loadBalancers': count_load_balancers(tenant_id),
        'databaseInstances': count_database_instances(tenant_id),
    }


def find_deployment_by_name(name: str, tenant_id: str) -> dict[str, Any] | None:
    doc = col('deployments').find_one({
        'name': name,
        **tenant_clause(tenant_id),
        '$or': [{'deletedAt': None}, {'deletedAt': {'$exists': False}}],
    })
    return map_deployment(doc) if doc else None


def soft_delete_deployment(deployment_id: str, tenant_id: str) -> bool:
    if not is_object_id_string(deployment_id):
        return False
    result = col('deployments').update_one(
        {'_id': as_object_id(deployment_id), **tenant_clause(tenant_id)},
        {'$set': {'status': 'stopped', 'deletedAt': datetime.now(timezone.utc)}},
    )
    return result.modified_count == 1


def find_api_key(prefix: str, key_hash: str) -> dict[str, Any] | None:
    doc = col('api_keys').find_one({'prefix': prefix, 'keyHash': key_hash})
    if not doc:
        return None
    expires = doc.get('expiresAt')
    if expires and expires < datetime.now(timezone.utc):
        return None
    mapped = map_api_key(doc)
    mapped['keyHash'] = doc['keyHash']
    return mapped


def mark_api_key_used(key_id: str) -> None:
    if not is_object_id_string(key_id):
        return
    col('api_keys').update_one({'_id': as_object_id(key_id)}, {'$set': {'lastUsedAt': datetime.now(timezone.utc)}})


def list_api_keys(tenant_id: str) -> list[dict[str, Any]]:
    docs = col('api_keys').find(tenant_clause(tenant_id)).sort('_id', -1)
    return [map_api_key(doc) for doc in docs]


def create_api_key(input_data: dict[str, Any]) -> dict[str, Any]:
    doc = {
        'tenantId': oid_or_raw(input_data['tenantId']),
        'userId': oid_or_raw(input_data['userId']),
        'name': input_data['name'],
        'keyHash': input_data['keyHash'],
        'prefix': input_data['prefix'],
        'scopes': input_data['scopes'],
        'expiresAt': input_data.get('expiresAt'),
        'lastUsedAt': None,
    }
    result = col('api_keys').insert_one(doc)
    doc['_id'] = result.inserted_id
    return map_api_key(doc)


def delete_api_key(key_id: str, tenant_id: str) -> bool:
    if not is_object_id_string(key_id):
        return False
    result = col('api_keys').delete_one({'_id': as_object_id(key_id), **tenant_clause(tenant_id)})
    return result.deleted_count == 1


def find_api_key_record(key_id: str, tenant_id: str) -> dict[str, Any] | None:
    if not is_object_id_string(key_id):
        return None
    doc = col('api_keys').find_one({'_id': as_object_id(key_id), **tenant_clause(tenant_id)})
    return map_api_key(doc) if doc else None


def write_audit_log(input_data: dict[str, Any]) -> None:
    try:
        resource_id = input_data.get('resourceId')
        col('audit_logs').insert_one({
            'tenantId': oid_or_raw(input_data['tenantId']),
            'userId': oid_or_raw(input_data['userId']) if input_data.get('userId') else None,
            'action': input_data['action'],
            'resourceType': input_data['resourceType'],
            'resourceId': as_object_id(resource_id) if resource_id and is_object_id_string(resource_id) else resource_id,
            'changes': input_data.get('changes') or {},
            'ipAddress': input_data.get('ipAddress'),
            'createdAt': datetime.now(timezone.utc),
        })
    except Exception as exc:
        print(f'audit log write failed: {exc}')


def list_audit_logs(tenant_id: str, limit: int = 50) -> list[dict[str, Any]]:
    safe_limit = min(max(limit, 1), 200)
    docs = col('audit_logs').find(tenant_clause(tenant_id)).sort('createdAt', -1).limit(safe_limit)
    return [map_audit_log(doc) for doc in docs]


def create_usage_metric(input_data: dict[str, Any]) -> dict[str, Any]:
    doc = {
        'tenantId': oid_or_raw(input_data['tenantId']),
        'deploymentId': oid_or_raw(input_data['deploymentId']) if input_data.get('deploymentId') else None,
        'gatewayId': oid_or_raw(input_data['gatewayId']) if input_data.get('gatewayId') else None,
        'metricType': input_data['metricType'],
        'value': input_data['value'],
        'windowStart': input_data['windowStart'],
        'windowEnd': input_data['windowEnd'],
    }
    result = col('usage_metrics').insert_one(doc)
    doc['_id'] = result.inserted_id
    return map_usage_metric(doc)


def list_usage_metrics(tenant_id: str, deployment_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    filt: dict[str, Any] = {**tenant_clause(tenant_id)}
    if deployment_id:
        vals: list[ObjectId | str] = [deployment_id]
        if is_object_id_string(deployment_id):
            vals.append(as_object_id(deployment_id))
        filt['deploymentId'] = {'$in': vals}
    safe_limit = min(max(limit, 1), 500)
    docs = col('usage_metrics').find(filt).sort('windowStart', -1).limit(safe_limit)
    return [map_usage_metric(doc) for doc in docs]


def sum_usage_for_tenant(tenant_id: str, metric_type: str = 'compute_seconds') -> float:
    pipeline = [
        {'$match': {**tenant_clause(tenant_id), 'metricType': metric_type}},
        {'$group': {'_id': None, 'total': {'$sum': '$value'}}},
    ]
    result = list(col('usage_metrics').aggregate(pipeline))
    return float(result[0]['total']) if result else 0.0


def list_projects(tenant_id: str) -> list[dict[str, Any]]:
    docs = col('projects').find(tenant_clause(tenant_id)).sort('createdAt', -1)
    return [map_project(doc) for doc in docs]


def find_project_by_id(project_id: str, tenant_id: str) -> dict[str, Any] | None:
    if not is_object_id_string(project_id):
        return None
    doc = col('projects').find_one({'_id': as_object_id(project_id), **tenant_clause(tenant_id)})
    return map_project(doc) if doc else None


def create_project(tenant_id: str, name: str, slug: str) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {'tenantId': oid_or_raw(tenant_id), 'name': name, 'slug': slug, 'createdAt': now}
    result = col('projects').insert_one(doc)
    doc['_id'] = result.inserted_id
    return map_project(doc)


def get_or_create_default_project(tenant_id: str) -> dict[str, Any]:
    existing = col('projects').find_one({**tenant_clause(tenant_id), 'slug': 'default'})
    if existing:
        return map_project(existing)
    return create_project(tenant_id, 'Default', 'default')


def migrate_deployments_to_default_project(tenant_id: str, project_id: str) -> None:
    col('deployments').update_many(
        {**tenant_clause(tenant_id), 'projectId': {'$exists': False}},
        {'$set': {'projectId': oid_or_raw(project_id)}},
    )


def list_buckets(tenant_id: str, project_id: str | None = None) -> list[dict[str, Any]]:
    filt: dict[str, Any] = {**tenant_clause(tenant_id)}
    if project_id:
        filt['projectId'] = oid_or_raw(project_id)
    docs = col('buckets').find(filt).sort('createdAt', -1)
    return [map_bucket(doc) for doc in docs]


def create_bucket(tenant_id: str, project_id: str, name: str) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {
        'tenantId': oid_or_raw(tenant_id),
        'projectId': oid_or_raw(project_id),
        'name': name,
        'createdAt': now,
    }
    result = col('buckets').insert_one(doc)
    doc['_id'] = result.inserted_id
    return map_bucket(doc)


def find_bucket_by_name(name: str, tenant_id: str) -> dict[str, Any] | None:
    doc = col('buckets').find_one({'name': name, **tenant_clause(tenant_id)})
    return map_bucket(doc) if doc else None


def create_invoice(input_data: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {
        'tenantId': oid_or_raw(input_data['tenantId']),
        'periodStart': input_data['periodStart'],
        'periodEnd': input_data['periodEnd'],
        'totalAmount': input_data['totalAmount'],
        'currency': input_data.get('currency', 'RWF'),
        'status': input_data.get('status', 'pending'),
        'irembopayTransactionId': input_data.get('irembopayTransactionId'),
        'breakdown': input_data.get('breakdown') or {},
        'createdAt': now,
    }
    result = col('invoices').insert_one(doc)
    doc['_id'] = result.inserted_id
    return map_invoice(doc)


def list_invoices(tenant_id: str, limit: int = 20) -> list[dict[str, Any]]:
    docs = col('invoices').find(tenant_clause(tenant_id)).sort('createdAt', -1).limit(limit)
    return [map_invoice(doc) for doc in docs]


def update_invoice(invoice_id: str, tenant_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    if not is_object_id_string(invoice_id):
        return None
    doc = col('invoices').find_one_and_update(
        {'_id': as_object_id(invoice_id), **tenant_clause(tenant_id)},
        {'$set': updates},
        return_document=ReturnDocument.AFTER,
    )
    return map_invoice(doc) if doc else None


def list_vms(tenant_id: str, project_id: str | None = None) -> list[dict[str, Any]]:
    filt: dict[str, Any] = {**tenant_clause(tenant_id)}
    if project_id:
        filt['projectId'] = oid_or_raw(project_id)
    docs = col('vms').find(filt).sort('createdAt', -1)
    return [map_vm(doc) for doc in docs]


def create_vm(input_data: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {
        'tenantId': oid_or_raw(input_data['tenantId']),
        'projectId': oid_or_raw(input_data['projectId']) if input_data.get('projectId') else None,
        'name': input_data['name'],
        'cpu': input_data.get('cpu', 1),
        'memoryMb': input_data.get('memoryMb', 512),
        'status': 'provisioning',
        'publicIp': None,
        'createdAt': now,
    }
    result = col('vms').insert_one(doc)
    doc['_id'] = result.inserted_id
    doc['status'] = 'running'
    col('vms').update_one({'_id': result.inserted_id}, {'$set': {'status': 'running', 'publicIp': '10.0.0.1'}})
    doc['publicIp'] = '10.0.0.1'
    return map_vm(doc)


def update_vm_status(vm_id: str, tenant_id: str, status: str) -> dict[str, Any] | None:
    if not is_object_id_string(vm_id):
        return None
    doc = col('vms').find_one_and_update(
        {'_id': as_object_id(vm_id), **tenant_clause(tenant_id)},
        {'$set': {'status': status}},
        return_document=ReturnDocument.AFTER,
    )
    return map_vm(doc) if doc else None


def list_gateways(tenant_id: str, project_id: str | None = None) -> list[dict[str, Any]]:
    filt: dict[str, Any] = {**tenant_clause(tenant_id)}
    if project_id:
        filt['projectId'] = oid_or_raw(project_id)
    docs = col('gateways').find(filt).sort('createdAt', -1)
    return [map_gateway(doc) for doc in docs]


def find_gateway_by_id(gateway_id: str, tenant_id: str) -> dict[str, Any] | None:
    if not is_object_id_string(gateway_id):
        return None
    doc = col('gateways').find_one({'_id': as_object_id(gateway_id), **tenant_clause(tenant_id)})
    return map_gateway(doc) if doc else None


def find_gateway_by_id_any(gateway_id: str) -> dict[str, Any] | None:
    if not is_object_id_string(gateway_id):
        return None
    doc = col('gateways').find_one({'_id': as_object_id(gateway_id)})
    return map_gateway(doc) if doc else None


def find_gateway_by_slug(slug: str, tenant_id: str) -> dict[str, Any] | None:
    doc = col('gateways').find_one({'slug': slug, **tenant_clause(tenant_id)})
    return map_gateway(doc) if doc else None


def create_gateway(input_data: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {
        'tenantId': oid_or_raw(input_data['tenantId']),
        'projectId': oid_or_raw(input_data['projectId']) if input_data.get('projectId') else None,
        'name': input_data['name'],
        'slug': input_data['slug'],
        'status': input_data.get('status', 'active'),
        'hostnames': input_data.get('hostnames') or [],
        'defaultStage': input_data.get('defaultStage', 'prod'),
        'createdAt': now,
        'updatedAt': now,
    }
    result = col('gateways').insert_one(doc)
    doc['_id'] = result.inserted_id
    return map_gateway(doc)


def update_gateway(gateway_id: str, tenant_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    if not is_object_id_string(gateway_id):
        return None
    updates = {**updates, 'updatedAt': datetime.now(timezone.utc)}
    doc = col('gateways').find_one_and_update(
        {'_id': as_object_id(gateway_id), **tenant_clause(tenant_id)},
        {'$set': updates},
        return_document=ReturnDocument.AFTER,
    )
    return map_gateway(doc) if doc else None


def delete_gateway(gateway_id: str, tenant_id: str) -> bool:
    if not is_object_id_string(gateway_id):
        return False
    gid = as_object_id(gateway_id)
    result = col('gateways').delete_one({'_id': gid, **tenant_clause(tenant_id)})
    if result.deleted_count:
        col('gateway_routes').delete_many({'gatewayId': gid})
        col('gateway_keys').delete_many({'gatewayId': gid})
    return result.deleted_count == 1


def count_gateway_routes(gateway_id: str) -> int:
    if not is_object_id_string(gateway_id):
        return 0
    return col('gateway_routes').count_documents({'gatewayId': as_object_id(gateway_id)})


def list_gateway_routes(gateway_id: str) -> list[dict[str, Any]]:
    if not is_object_id_string(gateway_id):
        return []
    docs = col('gateway_routes').find({'gatewayId': as_object_id(gateway_id)}).sort('path', 1)
    return [map_gateway_route(doc) for doc in docs]


def find_gateway_route_by_id(route_id: str, gateway_id: str) -> dict[str, Any] | None:
    if not is_object_id_string(route_id) or not is_object_id_string(gateway_id):
        return None
    doc = col('gateway_routes').find_one({
        '_id': as_object_id(route_id),
        'gatewayId': as_object_id(gateway_id),
    })
    return map_gateway_route(doc) if doc else None


def create_gateway_route(input_data: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {
        'gatewayId': oid_or_raw(input_data['gatewayId']),
        'stage': input_data.get('stage', 'prod'),
        'method': input_data.get('method', 'GET').upper(),
        'path': input_data['path'],
        'targetType': input_data.get('targetType', 'deployment'),
        'targetDeploymentId': oid_or_raw(input_data['targetDeploymentId']),
        'stripPathPrefix': bool(input_data.get('stripPathPrefix', False)),
        'timeoutMs': input_data.get('timeoutMs', 30000),
        'createdAt': now,
        'updatedAt': now,
    }
    result = col('gateway_routes').insert_one(doc)
    doc['_id'] = result.inserted_id
    return map_gateway_route(doc)


def update_gateway_route(route_id: str, gateway_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    if not is_object_id_string(route_id) or not is_object_id_string(gateway_id):
        return None
    updates = {**updates, 'updatedAt': datetime.now(timezone.utc)}
    if 'method' in updates:
        updates['method'] = updates['method'].upper()
    doc = col('gateway_routes').find_one_and_update(
        {'_id': as_object_id(route_id), 'gatewayId': as_object_id(gateway_id)},
        {'$set': updates},
        return_document=ReturnDocument.AFTER,
    )
    return map_gateway_route(doc) if doc else None


def delete_gateway_route(route_id: str, gateway_id: str) -> bool:
    if not is_object_id_string(route_id) or not is_object_id_string(gateway_id):
        return False
    result = col('gateway_routes').delete_one({
        '_id': as_object_id(route_id),
        'gatewayId': as_object_id(gateway_id),
    })
    return result.deleted_count == 1


def list_gateway_keys(gateway_id: str, tenant_id: str) -> list[dict[str, Any]]:
    if not is_object_id_string(gateway_id):
        return []
    docs = col('gateway_keys').find({
        'gatewayId': as_object_id(gateway_id),
        **tenant_clause(tenant_id),
        '$or': [{'revokedAt': None}, {'revokedAt': {'$exists': False}}],
    }).sort('createdAt', -1)
    return [map_gateway_key(doc) for doc in docs]


def find_gateway_key(prefix: str, key_hash: str) -> dict[str, Any] | None:
    doc = col('gateway_keys').find_one({
        'prefix': prefix,
        'keyHash': key_hash,
        '$or': [{'revokedAt': None}, {'revokedAt': {'$exists': False}}],
    })
    if not doc:
        return None
    mapped = map_gateway_key(doc)
    mapped['keyHash'] = doc['keyHash']
    return mapped


def create_gateway_key(input_data: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {
        'gatewayId': oid_or_raw(input_data['gatewayId']),
        'tenantId': oid_or_raw(input_data['tenantId']),
        'name': input_data.get('name', 'default'),
        'keyHash': input_data['keyHash'],
        'prefix': input_data['prefix'],
        'scopes': input_data.get('scopes') or ['invoke'],
        'rateLimitRpm': input_data.get('rateLimitRpm', 1000),
        'revokedAt': None,
        'lastUsedAt': None,
        'createdAt': now,
    }
    result = col('gateway_keys').insert_one(doc)
    doc['_id'] = result.inserted_id
    return map_gateway_key(doc)


def revoke_gateway_key(key_id: str, gateway_id: str, tenant_id: str) -> bool:
    if not is_object_id_string(key_id) or not is_object_id_string(gateway_id):
        return False
    result = col('gateway_keys').update_one(
        {
            '_id': as_object_id(key_id),
            'gatewayId': as_object_id(gateway_id),
            **tenant_clause(tenant_id),
        },
        {'$set': {'revokedAt': datetime.now(timezone.utc)}},
    )
    return result.modified_count == 1


def mark_gateway_key_used(key_id: str) -> None:
    if not is_object_id_string(key_id):
        return
    col('gateway_keys').update_one({'_id': as_object_id(key_id)}, {'$set': {'lastUsedAt': datetime.now(timezone.utc)}})


def list_all_active_gateways() -> list[dict[str, Any]]:
    docs = col('gateways').find({'status': 'active'}).sort('createdAt', -1)
    return [map_gateway(doc) for doc in docs]


def list_all_active_load_balancers() -> list[dict[str, Any]]:
    """Active HTTP/HTTPS LBs for nginx data-plane sync (TCP is metadata-only)."""
    docs = col('load_balancers').find({
        'status': 'active',
        'protocol': {'$in': ['HTTP', 'HTTPS']},
    }).sort('createdAt', -1)
    return [map_load_balancer(doc) for doc in docs]


def create_provision_job(input_data: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {
        'tenantId': oid_or_raw(input_data['tenantId']),
        'deploymentId': oid_or_raw(input_data['deploymentId']),
        'type': input_data.get('type', 'deployment.create'),
        'status': 'queued',
        'payload': input_data.get('payload') or {},
        'error': None,
        'attempts': 0,
        'createdAt': now,
        'updatedAt': now,
    }
    result = col('provision_jobs').insert_one(doc)
    doc['_id'] = result.inserted_id
    return map_provision_job(doc)


def find_provision_job_by_id(job_id: str) -> dict[str, Any] | None:
    if not is_object_id_string(job_id):
        return None
    doc = col('provision_jobs').find_one({'_id': as_object_id(job_id)})
    return map_provision_job(doc) if doc else None


def claim_next_provision_job() -> dict[str, Any] | None:
    now = datetime.now(timezone.utc)
    doc = col('provision_jobs').find_one_and_update(
        {'status': 'queued'},
        {'$set': {'status': 'processing', 'updatedAt': now}, '$inc': {'attempts': 1}},
        sort=[('createdAt', 1)],
        return_document=ReturnDocument.AFTER,
    )
    return map_provision_job(doc) if doc else None


def complete_provision_job(job_id: str, status: str, error: str | None = None) -> dict[str, Any] | None:
    if not is_object_id_string(job_id):
        return None
    updates: dict[str, Any] = {'status': status, 'updatedAt': datetime.now(timezone.utc)}
    if error is not None:
        updates['error'] = error
    doc = col('provision_jobs').find_one_and_update(
        {'_id': as_object_id(job_id)},
        {'$set': updates},
        return_document=ReturnDocument.AFTER,
    )
    return map_provision_job(doc) if doc else None


def requeue_provision_job(job_id: str, error: str) -> dict[str, Any] | None:
    if not is_object_id_string(job_id):
        return None
    doc = col('provision_jobs').find_one_and_update(
        {'_id': as_object_id(job_id)},
        {'$set': {'status': 'queued', 'error': error, 'updatedAt': datetime.now(timezone.utc)}},
        return_document=ReturnDocument.AFTER,
    )
    return map_provision_job(doc) if doc else None



def list_secrets(tenant_id: str, project_id: str | None = None) -> list[dict[str, Any]]:
    filt: dict[str, Any] = {**tenant_clause(tenant_id)}
    if project_id:
        filt['projectId'] = oid_or_raw(project_id)
    docs = col('secrets').find(filt).sort('createdAt', -1)
    return [map_secret(doc) for doc in docs]


def find_secret_by_id(secret_id: str, tenant_id: str, *, include_value: bool = False) -> dict[str, Any] | None:
    if not is_object_id_string(secret_id):
        return None
    doc = col('secrets').find_one({'_id': as_object_id(secret_id), **tenant_clause(tenant_id)})
    return map_secret(doc, include_value=include_value) if doc else None


def find_secret_by_name(name: str, tenant_id: str) -> dict[str, Any] | None:
    doc = col('secrets').find_one({'name': name, **tenant_clause(tenant_id)})
    return map_secret(doc) if doc else None


def create_secret(input_data: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {
        'tenantId': oid_or_raw(input_data['tenantId']),
        'projectId': oid_or_raw(input_data['projectId']) if input_data.get('projectId') else None,
        'name': input_data['name'],
        'ciphertext': input_data['ciphertext'],
        'version': 1,
        'createdAt': now,
        'updatedAt': now,
    }
    result = col('secrets').insert_one(doc)
    doc['_id'] = result.inserted_id
    return map_secret(doc)


def update_secret_value(secret_id: str, tenant_id: str, ciphertext: str) -> dict[str, Any] | None:
    if not is_object_id_string(secret_id):
        return None
    doc = col('secrets').find_one_and_update(
        {'_id': as_object_id(secret_id), **tenant_clause(tenant_id)},
        {
            '$set': {'ciphertext': ciphertext, 'updatedAt': datetime.now(timezone.utc)},
            '$inc': {'version': 1},
        },
        return_document=ReturnDocument.AFTER,
    )
    return map_secret(doc) if doc else None


def delete_secret(secret_id: str, tenant_id: str) -> bool:
    if not is_object_id_string(secret_id):
        return False
    result = col('secrets').delete_one({'_id': as_object_id(secret_id), **tenant_clause(tenant_id)})
    return result.deleted_count == 1


def list_load_balancers(tenant_id: str, project_id: str | None = None) -> list[dict[str, Any]]:
    filt: dict[str, Any] = {**tenant_clause(tenant_id)}
    if project_id:
        filt['projectId'] = oid_or_raw(project_id)
    docs = col('load_balancers').find(filt).sort('createdAt', -1)
    return [map_load_balancer(doc) for doc in docs]


def find_load_balancer_by_id(lb_id: str, tenant_id: str) -> dict[str, Any] | None:
    if not is_object_id_string(lb_id):
        return None
    doc = col('load_balancers').find_one({'_id': as_object_id(lb_id), **tenant_clause(tenant_id)})
    return map_load_balancer(doc) if doc else None


def create_load_balancer(input_data: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {
        'tenantId': oid_or_raw(input_data['tenantId']),
        'projectId': oid_or_raw(input_data['projectId']) if input_data.get('projectId') else None,
        'name': input_data['name'],
        'scheme': input_data.get('scheme', 'internet-facing'),
        'protocol': input_data.get('protocol', 'HTTP'),
        'port': input_data.get('port', 80),
        'dnsName': input_data.get('dnsName'),
        'targetDeploymentId': oid_or_raw(input_data['targetDeploymentId']) if input_data.get('targetDeploymentId') else None,
        'status': input_data.get('status', 'active'),
        'statusMessage': input_data.get('statusMessage'),
        'createdAt': now,
        'updatedAt': now,
    }
    result = col('load_balancers').insert_one(doc)
    doc['_id'] = result.inserted_id
    return map_load_balancer(doc)


def update_load_balancer(lb_id: str, tenant_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    if not is_object_id_string(lb_id):
        return None
    payload = {**updates, 'updatedAt': datetime.now(timezone.utc)}
    if 'targetDeploymentId' in payload and payload['targetDeploymentId']:
        payload['targetDeploymentId'] = oid_or_raw(payload['targetDeploymentId'])
    doc = col('load_balancers').find_one_and_update(
        {'_id': as_object_id(lb_id), **tenant_clause(tenant_id)},
        {'$set': payload},
        return_document=ReturnDocument.AFTER,
    )
    return map_load_balancer(doc) if doc else None


def delete_load_balancer(lb_id: str, tenant_id: str) -> bool:
    if not is_object_id_string(lb_id):
        return False
    result = col('load_balancers').delete_one({'_id': as_object_id(lb_id), **tenant_clause(tenant_id)})
    return result.deleted_count == 1


def list_database_instances(tenant_id: str, project_id: str | None = None) -> list[dict[str, Any]]:
    filt: dict[str, Any] = {**tenant_clause(tenant_id)}
    if project_id:
        filt['projectId'] = oid_or_raw(project_id)
    docs = col('database_instances').find(filt).sort('createdAt', -1)
    return [map_database_instance(doc) for doc in docs]


def find_database_instance_by_id(
    instance_id: str,
    tenant_id: str,
    *,
    include_connection: bool = False,
) -> dict[str, Any] | None:
    if not is_object_id_string(instance_id):
        return None
    doc = col('database_instances').find_one({'_id': as_object_id(instance_id), **tenant_clause(tenant_id)})
    return map_database_instance(doc, include_connection=include_connection) if doc else None


def create_database_instance(input_data: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {
        'tenantId': oid_or_raw(input_data['tenantId']),
        'projectId': oid_or_raw(input_data['projectId']) if input_data.get('projectId') else None,
        'name': input_data['name'],
        'engine': input_data.get('engine', 'postgres'),
        'version': input_data.get('version', '16'),
        'sizeGb': input_data.get('sizeGb', 10),
        'host': input_data.get('host'),
        'port': input_data.get('port'),
        'endpoint': input_data.get('endpoint'),
        'username': input_data.get('username'),
        'connectionString': input_data.get('connectionString'),
        'status': input_data.get('status', 'available'),
        'statusMessage': input_data.get('statusMessage'),
        'createdAt': now,
        'updatedAt': now,
    }
    result = col('database_instances').insert_one(doc)
    doc['_id'] = result.inserted_id
    return map_database_instance(doc, include_connection=True)


def update_database_instance(instance_id: str, tenant_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    if not is_object_id_string(instance_id):
        return None
    payload = {**updates, 'updatedAt': datetime.now(timezone.utc)}
    doc = col('database_instances').find_one_and_update(
        {'_id': as_object_id(instance_id), **tenant_clause(tenant_id)},
        {'$set': payload},
        return_document=ReturnDocument.AFTER,
    )
    return map_database_instance(doc) if doc else None


def delete_database_instance(instance_id: str, tenant_id: str) -> bool:
    if not is_object_id_string(instance_id):
        return False
    result = col('database_instances').delete_one({'_id': as_object_id(instance_id), **tenant_clause(tenant_id)})
    return result.deleted_count == 1


def find_system_secret_by_name(name: str, *, include_value: bool = False) -> dict[str, Any] | None:
    doc = col('system_secrets').find_one({'name': name})
    return map_system_secret(doc, include_value=include_value) if doc else None


def list_system_secrets() -> list[dict[str, Any]]:
    docs = col('system_secrets').find().sort('name', 1)
    return [map_system_secret(doc) for doc in docs]


def upsert_system_secret(name: str, ciphertext: str) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    existing = col('system_secrets').find_one({'name': name})
    if existing:
        doc = col('system_secrets').find_one_and_update(
            {'name': name},
            {
                '$set': {'ciphertext': ciphertext, 'updatedAt': now},
                '$inc': {'version': 1},
            },
            return_document=ReturnDocument.AFTER,
        )
        return map_system_secret(doc)
    doc = {
        'name': name,
        'ciphertext': ciphertext,
        'version': 1,
        'createdAt': now,
        'updatedAt': now,
    }
    result = col('system_secrets').insert_one(doc)
    doc['_id'] = result.inserted_id
    return map_system_secret(doc)


def delete_system_secret(name: str) -> bool:
    result = col('system_secrets').delete_one({'name': name})
    return result.deleted_count == 1
