-- ADR-065 (founder: "I want the website to sent actual notification ... I want
-- it to shoot me actual notifications") — the device registry behind web push.
--
-- One row per DEVICE that agreed to receive notifications, keyed on the
-- browser's push ENDPOINT: the endpoint is that device's address at its push
-- service, unique across the world, so re-subscribing the same device refreshes
-- its row instead of minting a second one, and a device that signs into another
-- account simply re-points to whoever is signed in now.
--
-- Nothing secret lives in this table. p256dh/auth are the BROWSER's public
-- subscription material and are useless without the endpoint they belong to;
-- the server's VAPID private key is read from the environment and is never
-- written to the database.
--
-- Every statement is IF NOT EXISTS / guarded, so the whole file is re-runnable
-- at boot (scripts/start.mjs retries `prisma migrate deploy`) and a
-- half-applied deploy can be replayed safely — the house rule since ADR-064.

-- CreateTable
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so the catalogue is asked first
-- (the same shape the rest of this file uses for its re-runnability).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PushSubscription_userId_fkey'
    ) THEN
        ALTER TABLE "PushSubscription"
            ADD CONSTRAINT "PushSubscription_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
