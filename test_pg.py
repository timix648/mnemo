import asyncio, asyncpg, sys
async def main(port):
    try:
        c = await asyncpg.connect(f"postgresql://mnemo_user:mnemo_password@localhost:{port}/mnemo_db")
        await c.close()
        print(f"PORT_{port}_OK")
    except Exception as e:
        print(f"PORT_{port}_FAIL: {type(e).__name__}: {e}")
asyncio.run(main(5433))
asyncio.run(main(5432))
