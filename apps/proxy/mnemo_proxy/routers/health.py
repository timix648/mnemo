from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health():
    return {"ok": True, "service": "mnemo-proxy", "version": "0.0.1"}
