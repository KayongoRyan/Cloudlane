from __future__ import annotations

from datetime import datetime
from typing import Optional

import strawberry
from strawberry.fastapi import GraphQLRouter
from strawberry.types import Info

import database as db
from auth import AuthContext, resolve_auth
from services.graphql_mutations import (
    mutation_create_bucket,
    mutation_create_database,
    mutation_create_database_backup,
    mutation_create_deployment,
    mutation_create_load_balancer,
    mutation_create_project,
    mutation_create_secret,
    mutation_delete_database,
    mutation_delete_deployment,
    mutation_delete_load_balancer,
    mutation_delete_secret,
    mutation_rotate_secret,
    mutation_update_database,
    mutation_update_load_balancer,
)
from services.quota import build_quota_report


@strawberry.type
class Project:
    id: str
    name: str
    slug: str
    created_at: Optional[datetime] = None

    @strawberry.field
    def deployments(self, info: Info) -> list['Deployment']:
        auth: AuthContext = info.context['auth']
        return [
            Deployment.from_doc(doc)
            for doc in db.list_deployments(auth.tenant_id)
            if doc.get('projectId') == self.id
        ]


@strawberry.type
class Deployment:
    id: str
    name: str
    status: str
    public_url: str
    cpu: float
    memory: int
    min_instances: int
    max_instances: int
    port: int

    @classmethod
    def from_doc(cls, doc: dict) -> Deployment:
        return cls(
            id=doc['id'],
            name=doc['name'],
            status=doc.get('status', 'unknown'),
            public_url=doc.get('publicUrl', ''),
            cpu=float(doc.get('cpu', 0)),
            memory=int(doc.get('memory', 0)),
            min_instances=int(doc.get('minInstances', 0)),
            max_instances=int(doc.get('maxInstances', 0)),
            port=int(doc.get('port', 8080)),
        )


@strawberry.type
class Secret:
    id: str
    name: str
    version: int

    @classmethod
    def from_doc(cls, doc: dict) -> Secret:
        return cls(id=doc['id'], name=doc['name'], version=int(doc.get('version', 1)))


@strawberry.type
class LoadBalancer:
    id: str
    name: str
    protocol: str
    port: int
    dns_name: Optional[str]
    status: str

    @classmethod
    def from_doc(cls, doc: dict) -> LoadBalancer:
        return cls(
            id=doc['id'],
            name=doc['name'],
            protocol=doc.get('protocol', 'HTTP'),
            port=int(doc.get('port', 80)),
            dns_name=doc.get('dnsName'),
            status=doc.get('status', 'active'),
        )


@strawberry.type
class DatabaseBackup:
    id: str
    status: str
    trigger: str
    size_bytes: int
    created_at: Optional[datetime] = None

    @classmethod
    def from_doc(cls, doc: dict) -> DatabaseBackup:
        return cls(
            id=doc['id'],
            status=doc.get('status', 'running'),
            trigger=doc.get('trigger', 'manual'),
            size_bytes=int(doc.get('sizeBytes', 0)),
            created_at=doc.get('createdAt'),
        )


@strawberry.type
class DatabaseInstance:
    id: str
    name: str
    engine: str
    version: str
    size_gb: int
    disk_used_mb: Optional[int]
    dedicated: bool
    endpoint: Optional[str]
    status: str

    @classmethod
    def from_doc(cls, doc: dict) -> DatabaseInstance:
        return cls(
            id=doc['id'],
            name=doc['name'],
            engine=doc.get('engine', 'postgres'),
            version=doc.get('version', '16'),
            size_gb=int(doc.get('sizeGb', 10)),
            disk_used_mb=doc.get('diskUsedMb'),
            dedicated=bool(doc.get('dedicated', False)),
            endpoint=doc.get('endpoint'),
            status=doc.get('status', 'available'),
        )

    @strawberry.field
    def backups(self, info: Info) -> list[DatabaseBackup]:
        auth: AuthContext = info.context['auth']
        return [
            DatabaseBackup.from_doc(doc)
            for doc in db.list_database_backups(auth.tenant_id, self.id)
        ]


@strawberry.type
class QuotaLimits:
    max_deployments: int
    max_cpu: float
    max_memory_mb: int
    max_instances: int
    max_database_instances: int
    max_database_storage_gb: int


@strawberry.type
class QuotaUsage:
    deployments: int
    total_cpu: float
    total_memory_mb: int
    database_instances: int
    database_storage_gb: int


@strawberry.type
class Quota:
    limits: QuotaLimits
    usage: QuotaUsage

    @classmethod
    def from_report(cls, report: dict) -> Quota:
        limits = report['limits']
        usage = report['usage']
        return cls(
            limits=QuotaLimits(
                max_deployments=int(limits['maxDeployments']),
                max_cpu=float(limits['maxCpu']),
                max_memory_mb=int(limits['maxMemoryMb']),
                max_instances=int(limits['maxInstances']),
                max_database_instances=int(limits['maxDatabaseInstances']),
                max_database_storage_gb=int(limits.get('maxDatabaseStorageGb', 50)),
            ),
            usage=QuotaUsage(
                deployments=int(usage['deployments']),
                total_cpu=float(usage['totalCpu']),
                total_memory_mb=int(usage['totalMemoryMb']),
                database_instances=int(usage['databaseInstances']),
                database_storage_gb=int(usage.get('databaseStorageGb', 0)),
            ),
        )


@strawberry.type
class Bucket:
    id: str
    name: str
    region: str

    @classmethod
    def from_doc(cls, doc: dict) -> Bucket:
        return cls(id=doc['id'], name=doc['name'], region=doc.get('region', 'local'))


@strawberry.type
class Gateway:
    id: str
    name: str
    slug: str
    status: str

    @classmethod
    def from_doc(cls, doc: dict) -> Gateway:
        return cls(
            id=doc['id'],
            name=doc['name'],
            slug=doc.get('slug', ''),
            status=doc.get('status', 'active'),
        )


@strawberry.type
class DeletePayload:
    ok: bool
    id: str


@strawberry.type
class DeploymentCreatePayload:
    deployment: Deployment
    job_id: str


@strawberry.type
class DatabaseBackupPayload:
    id: str
    status: str
    trigger: str
    size_bytes: int
    created_at: Optional[datetime] = None
    download_url: Optional[str] = None

    @classmethod
    def from_doc(cls, doc: dict) -> DatabaseBackupPayload:
        return cls(
            id=doc['id'],
            status=doc.get('status', 'running'),
            trigger=doc.get('trigger', 'manual'),
            size_bytes=int(doc.get('sizeBytes', 0)),
            created_at=doc.get('createdAt'),
            download_url=doc.get('downloadUrl'),
        )


@strawberry.input
class DeploymentCreateInput:
    name: str
    image: str
    port: int
    project_id: Optional[str] = None
    cpu: Optional[float] = None
    memory: Optional[int] = None
    min_instances: Optional[int] = None
    max_instances: Optional[int] = None


@strawberry.input
class LoadBalancerCreateInput:
    name: str
    protocol: str = 'HTTP'
    port: int = 80
    scheme: str = 'internet-facing'
    target_deployment_id: Optional[str] = None
    project_id: Optional[str] = None


@strawberry.input
class LoadBalancerUpdateInput:
    name: Optional[str] = None
    status: Optional[str] = None
    port: Optional[int] = None
    target_deployment_id: Optional[str] = None


@strawberry.input
class DatabaseCreateInput:
    name: str
    engine: str = 'postgres'
    version: str = '16'
    size_gb: int = 10
    dedicated: bool = False
    auto_backup: bool = True
    project_id: Optional[str] = None


@strawberry.input
class DatabaseUpdateInput:
    size_gb: Optional[int] = None
    auto_backup: Optional[bool] = None
    status: Optional[str] = None


@strawberry.type
class Mutation:
    @strawberry.mutation
    def create_project(self, info: Info, name: str) -> Project:
        auth: AuthContext = info.context['auth']
        request = info.context['request']
        doc = mutation_create_project(auth, request, name)
        return Project(
            id=doc['id'],
            name=doc['name'],
            slug=doc['slug'],
            created_at=doc.get('createdAt'),
        )

    @strawberry.mutation
    def create_deployment(self, info: Info, input: DeploymentCreateInput) -> DeploymentCreatePayload:
        auth: AuthContext = info.context['auth']
        request = info.context['request']
        doc, job_id = mutation_create_deployment(
            auth,
            request,
            name=input.name,
            image=input.image,
            port=input.port,
            project_id=input.project_id,
            cpu=input.cpu,
            memory=input.memory,
            min_instances=input.min_instances,
            max_instances=input.max_instances,
        )
        return DeploymentCreatePayload(deployment=Deployment.from_doc(doc), job_id=job_id)

    @strawberry.mutation
    def delete_deployment(self, info: Info, id: str) -> DeletePayload:
        auth: AuthContext = info.context['auth']
        request = info.context['request']
        ok = mutation_delete_deployment(auth, request, id)
        return DeletePayload(ok=ok, id=id)

    @strawberry.mutation
    def create_bucket(self, info: Info, name: str, project_id: Optional[str] = None) -> Bucket:
        auth: AuthContext = info.context['auth']
        request = info.context['request']
        doc = mutation_create_bucket(auth, request, name, project_id)
        return Bucket.from_doc(doc)

    @strawberry.mutation
    def create_secret(
        self,
        info: Info,
        name: str,
        value: str,
        project_id: Optional[str] = None,
    ) -> Secret:
        auth: AuthContext = info.context['auth']
        request = info.context['request']
        doc = mutation_create_secret(auth, request, name, value, project_id)
        return Secret.from_doc(doc)

    @strawberry.mutation
    def rotate_secret(self, info: Info, id: str, value: str) -> Secret:
        auth: AuthContext = info.context['auth']
        request = info.context['request']
        doc = mutation_rotate_secret(auth, request, id, value)
        return Secret.from_doc(doc)

    @strawberry.mutation
    def delete_secret(self, info: Info, id: str) -> DeletePayload:
        auth: AuthContext = info.context['auth']
        request = info.context['request']
        ok = mutation_delete_secret(auth, request, id)
        return DeletePayload(ok=ok, id=id)

    @strawberry.mutation
    def create_load_balancer(self, info: Info, input: LoadBalancerCreateInput) -> LoadBalancer:
        auth: AuthContext = info.context['auth']
        request = info.context['request']
        doc = mutation_create_load_balancer(
            auth,
            request,
            name=input.name,
            protocol=input.protocol,
            port=input.port,
            scheme=input.scheme,
            target_deployment_id=input.target_deployment_id,
            project_id=input.project_id,
        )
        return LoadBalancer.from_doc(doc)

    @strawberry.mutation
    def update_load_balancer(self, info: Info, id: str, input: LoadBalancerUpdateInput) -> LoadBalancer:
        auth: AuthContext = info.context['auth']
        request = info.context['request']
        doc = mutation_update_load_balancer(
            auth,
            request,
            id,
            name=input.name,
            status=input.status,
            port=input.port,
            target_deployment_id=input.target_deployment_id,
        )
        return LoadBalancer.from_doc(doc)

    @strawberry.mutation
    def delete_load_balancer(self, info: Info, id: str) -> DeletePayload:
        auth: AuthContext = info.context['auth']
        request = info.context['request']
        ok = mutation_delete_load_balancer(auth, request, id)
        return DeletePayload(ok=ok, id=id)

    @strawberry.mutation
    def create_database(self, info: Info, input: DatabaseCreateInput) -> DatabaseInstance:
        auth: AuthContext = info.context['auth']
        request = info.context['request']
        doc = mutation_create_database(
            auth,
            request,
            name=input.name,
            engine=input.engine,
            version=input.version,
            size_gb=input.size_gb,
            dedicated=input.dedicated,
            auto_backup=input.auto_backup,
            project_id=input.project_id,
        )
        return DatabaseInstance.from_doc(doc)

    @strawberry.mutation
    def update_database(self, info: Info, id: str, input: DatabaseUpdateInput) -> DatabaseInstance:
        auth: AuthContext = info.context['auth']
        doc = mutation_update_database(
            auth,
            id,
            size_gb=input.size_gb,
            auto_backup=input.auto_backup,
            status=input.status,
        )
        return DatabaseInstance.from_doc(doc)

    @strawberry.mutation
    def delete_database(self, info: Info, id: str) -> DeletePayload:
        auth: AuthContext = info.context['auth']
        request = info.context['request']
        ok = mutation_delete_database(auth, request, id)
        return DeletePayload(ok=ok, id=id)

    @strawberry.mutation
    def create_database_backup(self, info: Info, instance_id: str) -> DatabaseBackupPayload:
        auth: AuthContext = info.context['auth']
        request = info.context['request']
        doc = mutation_create_database_backup(auth, request, instance_id)
        return DatabaseBackupPayload.from_doc(doc)


@strawberry.type
class Query:
    @strawberry.field
    def projects(self, info: Info) -> list[Project]:
        auth: AuthContext = info.context['auth']
        return [
            Project(
                id=doc['id'],
                name=doc['name'],
                slug=doc['slug'],
                created_at=doc.get('createdAt'),
            )
            for doc in db.list_projects(auth.tenant_id)
        ]

    @strawberry.field
    def deployments(self, info: Info, project_id: Optional[str] = None) -> list[Deployment]:
        auth: AuthContext = info.context['auth']
        docs = db.list_deployments(auth.tenant_id)
        if project_id:
            docs = [doc for doc in docs if doc.get('projectId') == project_id]
        return [Deployment.from_doc(doc) for doc in docs]

    @strawberry.field
    def deployment(self, info: Info, id: str) -> Optional[Deployment]:
        auth: AuthContext = info.context['auth']
        doc = db.find_deployment_by_id(id, auth.tenant_id)
        return Deployment.from_doc(doc) if doc else None

    @strawberry.field
    def secrets(self, info: Info) -> list[Secret]:
        auth: AuthContext = info.context['auth']
        return [Secret.from_doc(doc) for doc in db.list_secrets(auth.tenant_id)]

    @strawberry.field
    def load_balancers(self, info: Info) -> list[LoadBalancer]:
        auth: AuthContext = info.context['auth']
        return [LoadBalancer.from_doc(doc) for doc in db.list_load_balancers(auth.tenant_id)]

    @strawberry.field
    def databases(self, info: Info) -> list[DatabaseInstance]:
        auth: AuthContext = info.context['auth']
        return [DatabaseInstance.from_doc(doc) for doc in db.list_database_instances(auth.tenant_id)]

    @strawberry.field
    def quota(self, info: Info) -> Quota:
        auth: AuthContext = info.context['auth']
        return Quota.from_report(build_quota_report(auth.tenant_id))

    @strawberry.field
    def buckets(self, info: Info) -> list[Bucket]:
        auth: AuthContext = info.context['auth']
        return [Bucket.from_doc(doc) for doc in db.list_buckets(auth.tenant_id)]

    @strawberry.field
    def gateways(self, info: Info) -> list[Gateway]:
        auth: AuthContext = info.context['auth']
        return [Gateway.from_doc(doc) for doc in db.list_gateways(auth.tenant_id)]


schema = strawberry.Schema(query=Query, mutation=Mutation)


async def get_graphql_context(request):
    auth = await resolve_auth(request)
    return {'auth': auth, 'request': request}


graphql_router = GraphQLRouter(schema, context_getter=get_graphql_context)
