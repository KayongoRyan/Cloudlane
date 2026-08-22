"""Minimal GraphQL read API for projects, deployments, and quota."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

import database as db
from auth import AuthContext, authenticate_request, require_scopes
from services.quota import build_quota_report

router = APIRouter()


class GraphQLRequest(BaseModel):
    query: str = Field(..., min_length=1)
    variables: dict[str, Any] | None = None


def _resolve(query: str, auth: AuthContext) -> dict[str, Any]:
    q = ' '.join(query.split()).lower()
    data: dict[str, Any] = {}

    if 'projects' in q:
        data['projects'] = db.list_projects(auth.tenant_id)
    if 'deployments' in q:
        data['deployments'] = db.list_deployments(auth.tenant_id)
    if 'quota' in q:
        data['quota'] = build_quota_report(auth.tenant_id)
    if 'secrets' in q:
        data['secrets'] = db.list_secrets(auth.tenant_id)
    if 'loadbalancers' in q or 'load_balancers' in q:
        data['loadBalancers'] = db.list_load_balancers(auth.tenant_id)
    if 'databases' in q or 'databaseinstances' in q:
        data['databases'] = db.list_database_instances(auth.tenant_id)

    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Supported fields: projects, deployments, quota, secrets, loadBalancers, databases',
        )
    return {'data': data}


@router.post('/')
async def graphql(body: GraphQLRequest, auth: AuthContext = Depends(authenticate_request)):
    require_scopes(auth, 'read')
    return _resolve(body.query, auth)


@router.get('/')
async def graphql_info():
    return {
        'graphql': True,
        'note': 'POST { query } with Bearer token. Supported selections: projects, deployments, quota, secrets, loadBalancers, databases',
    }
