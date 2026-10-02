import Constants from "expo-constants";
import { Platform } from "react-native";

function detectBaseUrl(): string {
  const fromExtra = (Constants.expoConfig?.extra as any)?.apiBaseUrl as string | undefined;
  if (fromExtra) return fromExtra;

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

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    throw new ApiRequestError(0, {
      code: "network_error",
      message: "Can't reach the server. Check your internet or server address.",
    });
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err: ApiError = json.error ?? {
      code: "unknown",
      message: `Request failed (${res.status})`,
    };
    throw new ApiRequestError(res.status, err);
  }
  return json as T;
}
