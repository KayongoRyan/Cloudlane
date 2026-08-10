from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr


class TokenResponse(BaseModel):
    token: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class DeploymentStatus(str, Enum):
    pending = 'pending'
    deploying = 'deploying'
    running = 'running'
    stopped = 'stopped'
    failed = 'failed'


class DeploymentCreate(BaseModel):
    name: str = Field(..., min_length=2)
    image: str = Field(..., min_length=3)
    port: int = Field(..., ge=1, le=65535)


class DeploymentOut(BaseModel):
    id: str
    tenant_id: str
    name: str
    image: str
    port: int
    subdomain: str
    status: DeploymentStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
