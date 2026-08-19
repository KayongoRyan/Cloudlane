from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class TokenResponse(BaseModel):
    token: str
    apiKey: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    organization: str


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=2)


class BucketCreate(BaseModel):
    name: str = Field(..., min_length=3)
    projectId: str | None = None


class VmCreate(BaseModel):
    name: str = Field(..., min_length=2)
    cpu: int = Field(default=1, ge=1, le=16)
    memoryMb: int = Field(default=512, ge=256, le=32768)
    projectId: str | None = None


class DeploymentCreate(BaseModel):
    name: str = Field(..., min_length=2)
    image: str = Field(..., min_length=3)
    port: int = Field(..., ge=1, le=65535)
    cpu: float | None = None
    memory: int | None = None
    minInstances: int | None = None
    maxInstances: int | None = None


class ApiKeyCreate(BaseModel):
    name: str | None = None
    scopes: list[str] | None = None
    expiresAt: str | None = None


class UsageMetricCreate(BaseModel):
    deploymentId: str | None = None
    gatewayId: str | None = None
    metricType: str
    value: float
    windowStart: str
    windowEnd: str


class GatewayCreate(BaseModel):
    name: str = Field(..., min_length=2)
    projectId: str | None = None
    defaultStage: str = Field(default='prod', pattern='^(prod|dev)$')


class GatewayUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2)
    status: str | None = Field(default=None, pattern='^(active|disabled)$')
    defaultStage: str | None = Field(default=None, pattern='^(prod|dev)$')


class GatewayRouteCreate(BaseModel):
    stage: str = Field(default='prod', pattern='^(prod|dev)$')
    method: str = Field(default='GET', min_length=3, max_length=10)
    path: str = Field(..., min_length=1)
    targetDeploymentId: str
    stripPathPrefix: bool = False
    timeoutMs: int = Field(default=30000, ge=1000, le=120000)


class GatewayRouteUpdate(BaseModel):
    stage: str | None = Field(default=None, pattern='^(prod|dev)$')
    method: str | None = Field(default=None, min_length=3, max_length=10)
    path: str | None = Field(default=None, min_length=1)
    targetDeploymentId: str | None = None
    stripPathPrefix: bool | None = None
    timeoutMs: int | None = Field(default=None, ge=1000, le=120000)


class GatewayKeyCreate(BaseModel):
    name: str | None = None
    scopes: list[str] | None = None
    rateLimitRpm: int = Field(default=1000, ge=1, le=100000)
