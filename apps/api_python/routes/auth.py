from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from schemas import LoginRequest, TokenResponse
from auth import authenticate_user, create_access_token

router = APIRouter()


@router.post('/login', response_model=TokenResponse)
async def login(data: LoginRequest):
    user = authenticate_user(data.email, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials')

    access_token = create_access_token(
        data={
            'email': user['email'],
            'tenant_id': str(user.get('tenantId', '')),
            'role': user.get('role', 'developer'),
        }
    )

    return JSONResponse({'token': access_token})
