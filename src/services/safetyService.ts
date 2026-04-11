import { apiRequest } from "./apiClient";

export async function blockHost(userId: string, hostId: string, baseUrl: string) {
  return apiRequest<{ ok: true }>("/safety/block", {
    method: "POST",
    baseUrl,
    body: { userId, hostId },
  });
}

export async function unblockHost(userId: string, hostId: string, baseUrl: string) {
  return apiRequest<{ ok: true }>("/safety/unblock", {
    method: "POST",
    baseUrl,
    body: { userId, hostId },
  });
}

export async function reportHost(
  userId: string,
  hostId: string,
  reason: string,
  baseUrl: string
) {
  return apiRequest<{ ok: true }>("/safety/report", {
    method: "POST",
    baseUrl,
    body: { userId, hostId, reason },
  });
}
