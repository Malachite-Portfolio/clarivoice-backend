import { ConversationPreview, Host, Message } from "../types/models";
import { apiRequest } from "./apiClient";

type ConversationsResponse = {
  items: ConversationPreview[];
  nextCursor: string | null;
};

type MessagesResponse = {
  items: Message[];
  nextCursor: string | null;
};

export async function fetchHosts(userId: string, baseUrl: string) {
  return apiRequest<Host[]>(`/hosts?userId=${encodeURIComponent(userId)}`, {
    baseUrl,
  });
}

export async function startConversation(userId: string, hostId: string, baseUrl: string) {
  return apiRequest<ConversationPreview>("/conversations/start", {
    method: "POST",
    baseUrl,
    body: { userId, hostId },
  });
}

export async function fetchConversations(
  userId: string,
  baseUrl: string,
  cursor?: string | null,
  limit = 30
) {
  const search = new URLSearchParams({
    userId,
    limit: String(limit),
  });
  if (cursor) {
    search.set("cursor", cursor);
  }
  return apiRequest<ConversationsResponse>(`/conversations?${search.toString()}`, {
    baseUrl,
  });
}

export async function fetchMessages(
  conversationId: string,
  userId: string,
  baseUrl: string,
  cursor?: string | null,
  limit = 40
) {
  const search = new URLSearchParams({
    userId,
    limit: String(limit),
  });
  if (cursor) {
    search.set("cursor", cursor);
  }
  return apiRequest<MessagesResponse>(
    `/conversations/${conversationId}/messages?${search.toString()}`,
    {
      baseUrl,
    }
  );
}

export async function sendMessage(
  conversationId: string,
  userId: string,
  text: string,
  baseUrl: string
) {
  return apiRequest<Message>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    baseUrl,
    body: { senderId: userId, senderType: "user", text },
  });
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
  baseUrl: string
) {
  return apiRequest<{ ok: true }>(`/conversations/${conversationId}/read`, {
    method: "POST",
    baseUrl,
    body: { userId },
  });
}
