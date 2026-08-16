from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from bson import ObjectId
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

from config import get_settings

DEFAULT_TENANT_LIMITS = {
    'maxDeployments': 8,
    'maxCpu': 1,
    'maxMemoryMb': 512,
    'maxInstances': 3,
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
    if isinstance(value, ObjectId):
        return value.hex
    return str(value) if value is not None else ''


def map_limits(raw: Any) -> dict[str, int]:
    data = raw if isinstance(raw, dict) else {}
    return {
        'maxDeployments': data.get('maxDeployments', DEFAULT_TENANT_LIMITS['maxDeployments']),
        'maxCpu': data.get('maxCpu', DEFAULT_TENANT_LIMITS['maxCpu']),
        'maxMemoryMb': data.get('maxMemoryMb', DEFAULT_TENANT_LIMITS['maxMemoryMb']),
        'maxInstances': data.get('maxInstances', DEFAULT_TENANT_LIMITS['maxInstances']),
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
        'publicUrl': public_url or '',
        'k8sNamespace': doc.get('k8sNamespace') or doc.get('kubernetesNamespace', ''),
        'port': doc.get('port', 8080),
        'deletedAt': doc.get('deletedAt'),
        'createdAt': doc.get('createdAt'),
    }


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
        'deploymentId': ref_str(doc['deploymentId']),
        'metricType': doc['metricType'],
        'value': doc['value'],
        'windowStart': doc['windowStart'],
        'windowEnd': doc['windowEnd'],
    }


def get_db() -> Database:
    global _client, _db
    if _db is not None:
        return _db

    settings = get_settings()
    url = to_direct_mongo_url(settings.database_url)
    if not url or not url.startswith('mongodb'):
        hint = (
            'Set DATABASE_URL in Netlify environment variables (MongoDB Atlas URI).'
            if settings.is_netlify
            else 'DATABASE_URL must be a mongodb:// or mongodb+srv:// URL.'
        )
        raise RuntimeError(hint)
    if settings.is_netlify and 'localhost' in url:
        raise RuntimeError('DATABASE_URL cannot point to localhost on Netlify. Use MongoDB Atlas.')

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
    settings = get_settings()
    if settings.is_netlify:
        return
    tenants = col('tenants')
    users = col('users')
    deployments = col('deployments')
    api_keys = col('api_keys')
    audit_logs = col('audit_logs')
    usage_metrics = col('usage_metrics')
    tenants.create_index('slug', unique=True)
    users.create_index('email', unique=True)
    users.create_index('tenantId')
    deployments.create_index('publicUrl', unique=True, sparse=True)
    deployments.create_index([('tenantId', 1), ('slug', 1)])
    deployments.create_index('tenantId')
    api_keys.create_index('prefix')
    api_keys.create_index('tenantId')
    api_keys.create_index('userId')
    audit_logs.create_index([('tenantId', 1), ('createdAt', -1)])
    usage_metrics.create_index([('tenantId', 1), ('deploymentId', 1), ('windowStart', -1)])


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
    tenant_doc = {
        'slug': slug,
        'name': name,
        'status': 'active',
        'tier': 'free',
        'limits': dict(DEFAULT_TENANT_LIMITS),
        'irembopayCustomerId': None,
        'createdAt': now,
    }
    tenant_result = tenants.insert_one(tenant_doc)
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
        'publicUrl': input_data['publicUrl'],
        'k8sNamespace': input_data['k8sNamespace'],
        'port': input_data['port'],
        'deletedAt': None,
        'createdAt': now,
    }
    result = col('deployments').insert_one(doc)
    doc['_id'] = result.inserted_id
    return map_deployment(doc)


def update_deployment_status(deployment_id: str, status: str) -> dict[str, Any]:
    if not is_object_id_string(deployment_id):
        raise ValueError('Deployment not found')
    doc = col('deployments').find_one_and_update(
        {'_id': as_object_id(deployment_id)},
        {'$set': {'status': status}},
        return_document=True,
    )
    if not doc:
        raise ValueError('Deployment not found')
    return map_deployment(doc)


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
        'deploymentId': oid_or_raw(input_data['deploymentId']),
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
