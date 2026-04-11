import { GiftItem, Message } from "../types/models";
import { apiRequest } from "./apiClient";

export async function fetchGiftCatalog(baseUrl: string) {
  return apiRequest<GiftItem[]>("/gifts/catalog", {
    baseUrl,
  });
}

export async function sendGift(
  baseUrl: string,
  payload: {
    userId: string;
    conversationId: string;
    giftId: string;
    note?: string;
  }
) {
  return apiRequest<Message>("/gifts/send", {
    method: "POST",
    baseUrl,
    body: payload,
  });
}
