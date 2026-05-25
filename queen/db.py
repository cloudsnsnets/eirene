"""
Queen Database — asyncpg + Postgres 16
Cloud SNS Pty Ltd
"""
import asyncpg
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://queen:queen@localhost/queen")

pool = None

async def init_db():
    global pool
    pool = await asyncpg.create_pool(DATABASE_URL)
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS nodes (
                id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                public_key    TEXT NOT NULL UNIQUE,
                route         TEXT NOT NULL,
                country       TEXT NOT NULL,
                tier          TEXT NOT NULL DEFAULT 'provisional',
                capacity      INTEGER NOT NULL DEFAULT 10,
                registered_at TIMESTAMPTZ DEFAULT NOW(),
                promoted_at   TIMESTAMPTZ,
                revoked_at    TIMESTAMPTZ,
                last_seen     TIMESTAMPTZ
            );
            CREATE TABLE IF NOT EXISTS strikes (
                id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                node_id   UUID REFERENCES nodes(id),
                reason    TEXT NOT NULL,
                struck_at TIMESTAMPTZ DEFAULT NOW(),
                struck_by TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS challenges (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                node_route  TEXT NOT NULL,
                challenge   TEXT NOT NULL,
                issued_at   TIMESTAMPTZ DEFAULT NOW(),
                expires_at  TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes',
                completed   BOOLEAN DEFAULT FALSE
            );
        """)
        # Materialised view for directory
        await conn.execute("""
            CREATE MATERIALIZED VIEW IF NOT EXISTS directory AS
                SELECT id, route, country, capacity, tier
                FROM nodes
                WHERE tier = 'full'
                AND last_seen > NOW() - INTERVAL '25 hours'
                ORDER BY RANDOM();
        """)
    return pool

async def get_pool():
    return pool
