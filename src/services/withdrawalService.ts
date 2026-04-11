import { Wallet, WithdrawalRequest } from "../types/models";
import { apiRequest } from "./apiClient";

type WrappedResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type CreateWithdrawalData = {
  request: unknown;
  wallet?: unknown;
  minimumAmount?: number | string | null;
};

type WithdrawalHistoryData = {
  items: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type WithdrawalHistoryPage = {
  items: WithdrawalRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type CreateWithdrawalResult = {
  request: WithdrawalRequest;
  wallet: Wallet | null;
  minimumAmount: number | null;
};

export type CreateWithdrawalPayload = {
  amount: number;
  bankName: string;
  accountHolderName: string;
  ifscCode: string;
  accountNumber: string;
};

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function toIsoDate(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return new Date().toISOString();
}

function normalizeStatus(value: unknown): WithdrawalRequest["status"] {
  const raw = typeof value === "string" ? value.toUpperCase() : "PENDING";
  switch (raw) {
    case "PENDING":
    case "APPROVED":
    case "IN_PROGRESS":
    case "PAYMENT_DONE":
    case "REJECTED":
      return raw;
    default:
      return "PENDING";
  }
}

export function normalizeWithdrawalRequest(payload: unknown): WithdrawalRequest {
  const item = (payload ?? {}) as Record<string, unknown>;
  const requestedAt = toIsoDate(item.requestedAt ?? item.createdAt);
  const createdAt = toIsoDate(item.createdAt ?? item.requestedAt ?? item.updatedAt);
  const updatedAt = toIsoDate(item.updatedAt ?? item.requestedAt ?? item.createdAt);

  return {
    id: String(item.id ?? ""),
    listenerId: typeof item.listenerId === "string" ? item.listenerId : null,
    amount: toNumber(item.amount ?? item.amountCoins),
    status: normalizeStatus(item.status),
    requestedAt,
    createdAt,
    updatedAt,
    adminNote:
      typeof item.adminNote === "string" && item.adminNote.trim() ? item.adminNote : null,
    transactionReference:
      typeof item.transactionReference === "string" && item.transactionReference.trim()
        ? item.transactionReference
        : null,
  };
}

function normalizeWallet(payload: unknown, ownerId: string): Wallet | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const item = payload as Record<string, unknown>;
  const balance = toNumber(item.balance ?? item.availableBalance);
  const updatedAt = toIsoDate(item.updatedAt);

  return {
    ownerId,
    ownerType: "host",
    balance,
    updatedAt,
  };
}

export async function createWithdrawalRequest(
  baseUrl: string,
  token: string,
  ownerId: string,
  payload: CreateWithdrawalPayload
): Promise<CreateWithdrawalResult> {
  const response = await apiRequest<WrappedResponse<CreateWithdrawalData>>("/withdrawal/create", {
    method: "POST",
    baseUrl,
    token,
    body: payload,
  });

  return {
    request: normalizeWithdrawalRequest(response.data.request),
    wallet: normalizeWallet(response.data.wallet, ownerId),
    minimumAmount:
      response.data.minimumAmount === null || response.data.minimumAmount === undefined
        ? null
        : toNumber(response.data.minimumAmount),
  };
}

export async function fetchWithdrawalHistory(
  baseUrl: string,
  token: string
): Promise<WithdrawalHistoryPage> {
  const response = await apiRequest<WrappedResponse<WithdrawalHistoryData>>("/withdrawal/my", {
    baseUrl,
    token,
  });

  const data = response.data;
  return {
    items: (data.items ?? []).map(normalizeWithdrawalRequest),
    pagination: {
      page: toNumber(data.pagination?.page, 1),
      limit: toNumber(data.pagination?.limit, 20),
      total: toNumber(data.pagination?.total, 0),
      totalPages: toNumber(data.pagination?.totalPages, 0),
    },
  };
}

export async function fetchWithdrawalDetail(
  baseUrl: string,
  token: string,
  withdrawalId: string
) {
  const response = await apiRequest<WrappedResponse<unknown>>(
    `/withdrawal/${encodeURIComponent(withdrawalId)}`,
    {
      baseUrl,
      token,
    }
  );

  return normalizeWithdrawalRequest(response.data);
}
