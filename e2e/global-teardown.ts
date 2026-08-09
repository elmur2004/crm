/* Stops the embedded e2e Postgres started by global-setup. */
export default async function globalTeardown() {
  const pg = (globalThis as Record<string, unknown>).__e2ePg as
    | { stop: () => Promise<void> }
    | undefined;
  await pg?.stop().catch(() => undefined);
}
