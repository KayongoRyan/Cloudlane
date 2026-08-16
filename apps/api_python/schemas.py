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
    deploymentId: str
    metricType: str
    value: float
    windowStart: str
    windowEnd: str
