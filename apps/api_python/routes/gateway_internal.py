from fastapi import APIRouter, Request, Response

from services.gateway_edge import extract_api_key, validate_gateway_request

router = APIRouter()


@router.get('/validate')
async def validate_edge_request(request: Request):
    hostname = request.headers.get('X-Gateway-Hostname') or request.headers.get('Host', '')
    route_id = request.headers.get('X-Cloudlane-Route-Id')
    api_key = extract_api_key(dict(request.headers))
    ok, message, ctx = validate_gateway_request(hostname, api_key, route_id)
    if not ok:
        return Response(content=message, status_code=401 if 'key' in message.lower() else 429)
    headers = {}
    if ctx:
        headers['X-Cloudlane-Gateway-Id'] = ctx['gatewayId']
        headers['X-Cloudlane-Key-Id'] = ctx['keyId']
    return Response(status_code=204, headers=headers)
