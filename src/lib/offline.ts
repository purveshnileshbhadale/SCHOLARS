/**
 * Local-first fallback for features whose tables have not been created yet.
 *
 * The app must stay usable before a migration is applied: reads come from
 * localStorage, writes go to localStorage, and everything is pushed to the
 * database automatically on the first load after the table exists.
 *
 * Only a genuinely missing table falls back. Permission errors (RLS) and
 * network failures stay real errors so we never hide a security problem.
 */

type DbError = { code?: string | null; message?: string | null } | null | undefined;

/** PostgREST: PGRST205 "table not found in schema cache". Postgres: 42P01. */
export function isMissingTable(err: DbError): boolean {
  if (!err) return false;
  if (err.code === "PGRST205" || err.code === "42P01") return true;
  const msg = (err.message ?? "").toLowerCase();
  return (
    msg.includes("could not find the table") ||
    msg.includes("in the schema cache") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}

/** True when the table exists but the column does not (older schema version). */
export function isMissingColumn(err: DbError): boolean {
  if (!err) return false;
  if (err.code === "42703") return true;
  const msg = (err.message ?? "").toLowerCase();
  return msg.includes("column") && msg.includes("does not exist");
}

const PREFIX = "sa_local_v1";

function storageKey(userId: string, table: string): string {
  return `${PREFIX}:${table}:${userId}`;
}

export function localRows<T>(userId: string, table: string): T[] {
  try {
    const raw = localStorage.getItem(storageKey(userId, table));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalRows<T>(userId: string, table: string, rows: T[]): void {
  try {
    if (!rows.length) localStorage.removeItem(storageKey(userId, table));
    else localStorage.setItem(storageKey(userId, table), JSON.stringify(rows));
  } catch {
    /* quota or private mode — the UI still works for this session */
  }
}

export function hasLocalRows(userId: string, table: string): boolean {
  return localRows(userId, table).length > 0;
}

/** UUID v4 so a locally created row can be inserted into the real table later. */
export function localId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Push rows captured while the table was missing, then clear them.
 * Safe to call on every load: it is a no-op when nothing is pending.
 * A duplicate-key error still clears the queue, otherwise it would retry forever.
 */
export async function syncLocalRows<T>(
  userId: string,
  table: string,
  push: (rows: T[]) => Promise<{ error: DbError }>,
): Promise<void> {
  const pending = localRows<T>(userId, table);
  if (!pending.length) return;
  try {
    const { error } = await push(pending);
    if (!error || error.code === "23505") saveLocalRows<T>(userId, table, []);
    else if (!isMissingTable(error)) console.warn(`local sync failed for ${table}`, error);
  } catch (e) {
    console.warn(`local sync failed for ${table}`, e);
  }
}

/** Keep a local list for a feature that does not live in a table (e.g. roadmap statuses). */
export function readLocalMap<T>(userId: string, key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(`${PREFIX}:${key}:${userId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, T>) : {};
  } catch {
    return {};
  }
}

export function writeLocalMap<T>(userId: string, key: string, value: Record<string, T>): void {
  try {
    localStorage.setItem(`${PREFIX}:${key}:${userId}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
