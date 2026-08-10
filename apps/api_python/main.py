from fastapi import FastAPI
from routes import auth, deployments, health

app = FastAPI(
    title='Cloudlane API',
    description='FastAPI service that manages Cloudlane deployments and authentication.',
    version='0.1.0',
)

app.include_router(auth.router, prefix='/api/auth', tags=['auth'])
app.include_router(deployments.router,
                   prefix='/api/deployments', tags=['deployments'])
app.include_router(health.router, prefix='/api', tags=['health'])


@app.get('/')
async def root():
    return {'message': 'Cloudlane FastAPI service is running.'}
