import { setServers as dnsSetServers } from "node:dns";
import dns from "node:dns/promises";
import { parse } from "pg-connection-string";
import { Pool, type PoolConfig } from "pg";

let poolPromise: Promise<Pool> | null = null;

/**
 * Some ISPs / captive portals return NXDOMAIN for `db.*.supabase.co`.
 * `dns.setServers` only affects `dns.resolve*` — not `dns.lookup` (used by `pg` on Windows).
 * We resolve AAAA/A via public DNS, then connect by IP with TLS SNI.
 */
function usePublicDnsIfNeeded(): void {
  if (process.env.DATABASE_USE_SYSTEM_DNS === "true") return;
  const custom = process.env.DATABASE_DNS_SERVERS?.trim();
  const servers = custom
    ? custom.split(/[\s,]+/).filter(Boolean)
    : ["8.8.8.8", "1.1.1.1"];
  try {
    dnsSetServers(servers);
  } catch {
    /* ignore */
  }
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

function sslForHost(
  connectionString: string,
  servername?: string
): PoolConfig["ssl"] {
  const needSsl =
    /supabase\.(co|com)/i.test(connectionString) ||
    process.env.DATABASE_SSL === "require";
  if (!needSsl) return undefined;
  return servername
    ? { rejectUnauthorized: false, servername }
    : { rejectUnauthorized: false };
}

async function resolveSupabaseHost(hostname: string): Promise<string> {
  usePublicDnsIfNeeded();
  try {
    const v4 = await dns.resolve4(hostname);
    if (v4[0]) return v4[0];
  } catch {
    /* no A record (common on Supabase direct host) */
  }
  try {
    const v6 = await dns.resolve6(hostname);
    if (v6[0]) return v6[0];
  } catch {
    /* no AAAA */
  }
  throw new Error(
    `Could not resolve ${hostname}. Check the project ref, your network, or use the Session pooler URI from Supabase (Connect).`
  );
}

function shouldResolveHostname(hostname: string | undefined): boolean {
  return !!hostname && hostname.includes("db.") && hostname.includes("supabase.co");
}

async function buildPool(): Promise<Pool> {
  const connectionString = getDatabaseUrl();
  const parsed = parse(connectionString);
  const hostname = parsed.host ?? undefined;

  if (!shouldResolveHostname(hostname)) {
    return new Pool({
      connectionString,
      ssl: sslForHost(connectionString, hostname),
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  const ip = await resolveSupabaseHost(hostname!);
  const port = parsed.port ? Number(parsed.port) : 5432;
  return new Pool({
    host: ip,
    port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database ?? undefined,
    ssl: sslForHost(connectionString, hostname),
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

export async function getPool(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = buildPool();
  }
  return poolPromise;
}
