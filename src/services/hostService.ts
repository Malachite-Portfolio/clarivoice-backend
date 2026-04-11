import {
  AvailabilityStatus,
  CallRecord,
  ConversationPreview,
  Host,
  HostDashboard,
  Message,
  Wallet,
  WalletTransaction,
} from "../types/models";
import { apiRequest } from "./apiClient";

type PagedResponse<T> = {
  items: T[];
  nextCursor: string | null;
};

export async function fetchHostProfile(hostId: string, baseUrl: string, userId?: string) {
  const search = new URLSearchParams();
  if (userId) {
    search.set("userId", userId);
  }
  const query = search.toString();
  return apiRequest<Host>(`/hosts/${encodeURIComponent(hostId)}${query ? `?${query}` : ""}`, {
    baseUrl,
  });
}

export async function fetchHostDashboard(hostId: string, baseUrl: string) {
  return apiRequest<HostDashboard>(`/host/dashboard?hostId=${encodeURIComponent(hostId)}`, {
    baseUrl,
  });
}

export async function updateHostAvailability(
  hostId: string,
  availability: AvailabilityStatus,
  baseUrl: string
) {
  return apiRequest<Host>("/host/availability", {
    method: "POST",
    baseUrl,
    body: { hostId, availability },
  });
}

export async function fetchHostConversations(
  hostId: string,
  baseUrl: string,
  cursor?: string | null,
  limit = 30
) {
  const search = new URLSearchParams({
    hostId,
    limit: String(limit),
  });
  if (cursor) {
    search.set("cursor", cursor);
  }
  return apiRequest<PagedResponse<ConversationPreview>>(
    `/host/conversations?${search.toString()}`,
    {
      baseUrl,
    }
  );
}

export async function fetchHostMessages(
  conversationId: string,
  hostId: string,
  baseUrl: string,
  cursor?: string | null,
  limit = 40
) {
  const search = new URLSearchParams({
    hostId,
    limit: String(limit),
  });
  if (cursor) {
    search.set("cursor", cursor);
  }
  return apiRequest<PagedResponse<Message>>(
    `/host/conversations/${conversationId}/messages?${search.toString()}`,
    {
      baseUrl,
    }
  );
}

export async function sendHostMessage(
  conversationId: string,
  hostId: string,
  text: string,
  baseUrl: string
) {
  return apiRequest<Message>(`/host/conversations/${conversationId}/messages`, {
    method: "POST",
    baseUrl,
    body: { hostId, text },
  });
}

export async function markHostConversationRead(
  conversationId: string,
  hostId: string,
  baseUrl: string
) {
  return apiRequest<{ ok: true }>(`/host/conversations/${conversationId}/read`, {
    method: "POST",
    baseUrl,
    body: { hostId },
  });
}

export async function fetchHostWallet(hostId: string, baseUrl: string) {
  return apiRequest<Wallet>(`/host/earnings/wallet?hostId=${encodeURIComponent(hostId)}`, {
    baseUrl,
  });
}

export async function fetchHostTransactions(
  hostId: string,
  baseUrl: string,
  cursor?: string | null,
  limit = 20
) {
  const search = new URLSearchParams({
    hostId,
    limit: String(limit),
  });
  if (cursor) {
    search.set("cursor", cursor);
  }
  return apiRequest<PagedResponse<WalletTransaction>>(
    `/host/earnings/transactions?${search.toString()}`,
    {
      baseUrl,
    }
  );
}

export async function fetchHostGiftHistory(
  hostId: string,
  baseUrl: string,
  cursor?: string | null,
  limit = 20
) {
  const search = new URLSearchParams({
    hostId,
    limit: String(limit),
  });
  if (cursor) {
    search.set("cursor", cursor);
  }
  return apiRequest<PagedResponse<Message>>(`/host/gifts/history?${search.toString()}`, {
    baseUrl,
  });
}

export async function reportUserByHost(
  hostId: string,
  userId: string,
  reason: string,
  baseUrl: string
) {
  return apiRequest<{ ok: true }>("/host/safety/report", {
    method: "POST",
    baseUrl,
    body: { hostId, userId, reason },
  });
}

export async function blockUserByHost(hostId: string, userId: string, baseUrl: string) {
  return apiRequest<{ ok: true }>("/host/safety/block", {
    method: "POST",
    baseUrl,
    body: { hostId, userId },
  });
}

export async function unblockUserByHost(hostId: string, userId: string, baseUrl: string) {
  return apiRequest<{ ok: true }>("/host/safety/unblock", {
    method: "POST",
    baseUrl,
    body: { hostId, userId },
  });
}

export async function fetchHostUsers(hostId: string, baseUrl: string) {
  return apiRequest<Array<{ id: string; displayName: string; avatarUrl: string }>>(
    `/host/users?hostId=${encodeURIComponent(hostId)}`,
    {
      baseUrl,
    }
  );
}

export async function startHostConversation(hostId: string, userId: string, baseUrl: string) {
  return apiRequest<ConversationPreview>("/host/conversations/start", {
    method: "POST",
    baseUrl,
    body: { hostId, userId },
  });
}

export async function fetchHostCalls(
  hostId: string,
  baseUrl: string,
  cursor?: string | null,
  limit = 30
) {
  const search = new URLSearchParams({
    hostId,
    limit: String(limit),
  });
  if (cursor) {
    search.set("cursor", cursor);
  }
  return apiRequest<PagedResponse<CallRecord>>(`/calls?${search.toString()}`, {
    baseUrl,
  });
}
