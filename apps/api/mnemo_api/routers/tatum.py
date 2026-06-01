"""Tatum-powered Sui RPC read (server-side).

Demonstrates Mnemo's use of Tatum's Sui RPC nodes. Runs server-side so there's
no CORS restriction, and it's a single low-frequency read so it stays within
the free-tier rate limit. The high-volume relayer intentionally uses a
dedicated fullnode; Tatum is used here for on-demand chain status reads.
"""
import os
import logging
import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/sui", tags=["sui"])
log = logging.getLogger("mnemo.api.tatum")

TATUM_RPC_URL = os.environ.get("TATUM_RPC_URL", "https://sui-testnet.gateway.tatum.io")
TATUM_API_KEY = os.environ.get("TATUM_API_KEY", "")


async def _tatum_rpc(method: str, params: list | None = None) -> dict:
    """Make a single JSON-RPC call to Sui via Tatum's gateway (server-side)."""
    payload = {"id": 1, "jsonrpc": "2.0", "method": method, "params": params or []}
    headers = {"content-type": "application/json"}
    if TATUM_API_KEY:
        headers["x-api-key"] = TATUM_API_KEY
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(TATUM_RPC_URL, json=payload, headers=headers)
        if resp.status_code != 200:
            log.warning("Tatum RPC %s -> %s", method, resp.status_code)
            raise HTTPException(status_code=502, detail=f"Tatum RPC error: {resp.status_code}")
        data = resp.json()
        if "error" in data:
            raise HTTPException(status_code=502, detail=f"Tatum RPC error: {data['error']}")
        return data


@router.get("/status")
async def sui_status():
    """Return current Sui testnet checkpoint via Tatum's RPC. Used by the UI to
    show live chain status and to prove the Tatum integration."""
    data = await _tatum_rpc("sui_getLatestCheckpointSequenceNumber")
    return {"rpc_provider": "tatum", "network": "testnet", "latest_checkpoint": data.get("result")}