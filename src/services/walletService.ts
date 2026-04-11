import { TopupIntent, Wallet, WalletTransaction } from "../types/models";
import { apiRequest } from "./apiClient";

type WalletTransactionsResponse = {
  items: WalletTransaction[];
  nextCursor: string | null;
};

export async function fetchWallet(userId: string, baseUrl: string) {
  return apiRequest<Wallet>(`/wallet?userId=${encodeURIComponent(userId)}`, {
    baseUrl,
  });
}

export async function fetchWalletTransactions(
  userId: string,
  baseUrl: string,
  cursor?: string | null,
  limit = 20
) {
  const search = new URLSearchParams({
    userId,
    limit: String(limit),
  });
  if (cursor) {
    search.set("cursor", cursor);
  }
  return apiRequest<WalletTransactionsResponse>(`/wallet/transactions?${search.toString()}`, {
    baseUrl,
  });
}

export async function createTopupIntent(
  userId: string,
  baseUrl: string,
  amountInr: number,
  coins: number
) {
  return apiRequest<TopupIntent>("/wallet/topup-intent", {
    method: "POST",
    baseUrl,
    body: { userId, amountInr, coins },
  });
}

export async function confirmTopup(
  userId: string,
  intentId: string,
  baseUrl: string,
  success: boolean
) {
  return apiRequest<TopupIntent>("/wallet/topup-confirm", {
    method: "POST",
    baseUrl,
    body: { userId, intentId, success },
  });
}
