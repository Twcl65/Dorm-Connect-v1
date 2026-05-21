import Constants from "expo-constants";

const API_PORT = 3000;

/** Metro / Expo dev server host (e.g. 192.168.1.5 from hostUri). */
function getMetroHost(): string | null {
  const raw =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | null)?.debuggerHost ??
    (Constants.expoGoConfig as { hostUri?: string } | null)?.hostUri;

  if (!raw) return null;
  const host = raw.split(":")[0]?.trim();
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

function isLoopbackUrl(base: string): boolean {
  try {
    const h = new URL(base).hostname;
    return h === "localhost" || h === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * Base URL of the Dorm Connect Next.js server (no trailing slash).
 * On a physical device, localhost in .env is replaced with Metro's LAN IP.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim()?.replace(/\/$/, "");
  const metroHost = getMetroHost();

  if (fromEnv && isLoopbackUrl(fromEnv) && metroHost) {
    return `http://${metroHost}:${API_PORT}`;
  }
  if (fromEnv) return fromEnv;
  if (metroHost) return `http://${metroHost}:${API_PORT}`;
  return `http://localhost:${API_PORT}`;
}

/** True when Expo is on a real device but the API URL is still localhost. */
export function isLoopbackApiOnPhysicalDevice(): boolean {
  if (!getMetroHost()) return false;
  return isLoopbackUrl(getApiBaseUrl());
}

/** Label for the login screen (shows when localhost was rewritten for a device). */
export function describeApiBaseUrl(): string {
  const resolved = getApiBaseUrl();
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim()?.replace(/\/$/, "");
  const metroHost = getMetroHost();

  if (fromEnv && isLoopbackUrl(fromEnv) && metroHost && resolved !== fromEnv) {
    return `${resolved}\n(using PC IP — .env localhost does not work on a real phone)`;
  }
  return resolved;
}

/** Turn `/uploads/...` or absolute URLs into a fetchable image URI. */
export function resolveMediaUrl(path: string | null | undefined): string | null {
  const p = path?.trim();
  if (!p) return null;
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  if (p.startsWith("/")) return `${getApiBaseUrl()}${p}`;
  return null;
}
