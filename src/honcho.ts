import type { HonchoConfig } from "@honcho-ai/sdk";

const DEFAULT_HONCHO_BASE_URL = "http://localhost:8000";

export function getHonchoBaseURL(): string {
  // Prefer the docs-facing env var, but keep the older SDK env name working too.
  return (
    process.env.HONCHO_BASE_URL ||
    process.env.HONCHO_URL ||
    DEFAULT_HONCHO_BASE_URL
  );
}

export function getHonchoWorkspaceId(fallback = "default"): string {
  return process.env.HONCHO_WORKSPACE_ID || fallback;
}

export function getHonchoConfig(options?: {
  workspaceId?: string;
}): HonchoConfig {
  return {
    apiKey: process.env.HONCHO_API_KEY || undefined,
    baseURL: getHonchoBaseURL(),
    workspaceId: getHonchoWorkspaceId(options?.workspaceId),
  };
}
