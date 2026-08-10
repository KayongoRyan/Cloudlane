from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from auth import get_current_user
from schemas import DeploymentCreate, DeploymentOut, DeploymentStatus
from database import db

router = APIRouter()


@router.get('/', response_model=list[DeploymentOut])
async def list_deployments(current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get('tenantId') or current_user.get('tenant_id')
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing tenant context')

    deployments = list(db.deployments.find({'tenantId': tenant_id}))
    return [
        DeploymentOut(
            id=str(item['_id']),
            tenant_id=item['tenantId'],
            name=item['name'],
            image=item['image'],
            port=item['port'],
            subdomain=item['subdomain'],
            status=DeploymentStatus(item.get('status', 'pending')),
            created_at=item.get('createdAt', datetime.utcnow()),
            updated_at=item.get('updatedAt', datetime.utcnow()),
        )
        for item in deployments
    ]


@router.post('/', response_model=DeploymentOut, status_code=status.HTTP_201_CREATED)
async def create_deployment(payload: DeploymentCreate, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get('tenantId') or current_user.get('tenant_id')
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing tenant context')

    deployment_name = payload.name.replace(' ', '-').lower()
    subdomain = f"{deployment_name}-{datetime.utcnow().timestamp():.0f}"
    deployment_doc = {
        'tenantId': tenant_id,
        'name': deployment_name,
        'image': payload.image,
        'port': payload.port,
        'subdomain': subdomain,
        'status': DeploymentStatus.deploying.value,
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow(),
    }

    result = db.deployments.insert_one(deployment_doc)
    deployment_doc['_id'] = result.inserted_id
    deployment_doc['status'] = DeploymentStatus.running.value
    deployment_doc['updatedAt'] = datetime.utcnow()
    db.deployments.update_one({'_id': deployment_doc['_id']}, {'$set': {
                              'status': deployment_doc['status'], 'updatedAt': deployment_doc['updatedAt']}})

    return DeploymentOut(
        id=str(deployment_doc['_id']),
        tenant_id=tenant_id,
        name=deployment_doc['name'],
        image=deployment_doc['image'],
        port=deployment_doc['port'],
        subdomain=deployment_doc['subdomain'],
        status=DeploymentStatus.running,
        created_at=deployment_doc['createdAt'],
        updated_at=deployment_doc['updatedAt'],
    )
