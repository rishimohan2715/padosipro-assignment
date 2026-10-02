import Constants from "expo-constants";
import { Platform } from "react-native";

function detectBaseUrl(): string {
  // Baked in at build time — this is what a packaged APK uses, since it has no
  // dev server to auto-detect from. Set via eas.json `env` or a local .env.
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  const fromExtra = (Constants.expoConfig?.extra as any)?.apiBaseUrl as string | undefined;
  if (fromExtra) return fromExtra.replace(/\/+$/, "");

  // Auto-detect: use the IP Expo's dev server is reachable at (works for Expo Go on a phone
  // and on both simulators without any hardcoded IP).
  const hostUri =
    (Constants.expoConfig as any)?.hostUri ??
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ??
    (Constants as any)?.manifest?.debuggerHost;
  const host = typeof hostUri === "string" ? hostUri.split(":")[0] : undefined;
  if (host) return `http://${host}:4000`;

  return Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";
}

export const API_BASE_URL = detectBaseUrl();

export type ApiError = { code: string; message: string; details?: unknown };

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, body: ApiError) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  token?: string | null;
};

// The API is on a free host that sleeps when idle; the first request after that
// pays a cold start of roughly a minute. Better to wait than to fail a reviewer's
// very first tap.
const REQUEST_TIMEOUT_MS = 75_000;

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    throw new ApiRequestError(0, {
      code: (e as Error)?.name === "AbortError" ? "timeout" : "network_error",
      message:
        (e as Error)?.name === "AbortError"
          ? "The server took too long to respond. Please try again."
          : "Can't reach the server. Check your connection and try again.",
    });
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  // A sleeping or restarting host answers with an HTML error page, so never
  // assume the body is JSON — parsing it blind turns that into a crash.
  let json: any = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new ApiRequestError(res.status, {
        code: res.ok ? "bad_response" : "server_unavailable",
        message: res.ok
          ? "Got an unexpected response from the server."
          : "The server is starting up. Please try again in a moment.",
      });
    }
  }

  if (!res.ok) {
    const err: ApiError = json.error ?? {
      code: "unknown",
      message: `Request failed (${res.status})`,
    };
    throw new ApiRequestError(res.status, err);
  }
  return json as T;
}
