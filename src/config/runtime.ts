import * as Application from "expo-application";
import { AppRole } from "../types/models";

const LIVE_API_BASE_URL = "https://clarivoice-api-1032786255556.asia-south1.run.app/api/v1";

function stripTrailingSlash(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function withProtocol(value: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return `https://${value}`;
}

export function normalizeBaseUrl(value: string) {
  const trimmed = stripTrailingSlash(value);
  if (!trimmed) {
    return LIVE_API_BASE_URL;
  }
  return stripTrailingSlash(withProtocol(trimmed));
}

export function getDefaultApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  return normalizeBaseUrl(envUrl || LIVE_API_BASE_URL);
}

export function toWebSocketUrl(baseUrl: string) {
  return baseUrl.replace("http://", "ws://").replace("https://", "wss://");
}

export function getAppRole(): AppRole {
  const envRole = process.env.EXPO_PUBLIC_APP_ROLE;
  if (envRole === "host" || envRole === "user") {
    return envRole;
  }

  const applicationId = Application.applicationId ?? "";
  if (applicationId.includes(".host")) {
    return "host";
  }

  return "user";
}
