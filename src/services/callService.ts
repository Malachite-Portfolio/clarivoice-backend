import { AppRole, CallRecord, CallState } from "../types/models";
import { apiRequest } from "./apiClient";

export const CALL_RATE_PER_MINUTE = 50;
export const MIN_CALL_START_COINS = CALL_RATE_PER_MINUTE;

type CallsResponse = {
  items: CallRecord[];
  nextCursor: string | null;
};

export function isCallTerminal(state: CallState) {
  return state === "declined" || state === "ended" || state === "missed" || state === "failed";
}

export function isCallActive(state: CallState) {
  return !isCallTerminal(state);
}

export async function fetchCalls(
  participantId: string,
  baseUrl: string,
  cursor?: string | null,
  limit = 30,
  role: AppRole = "user"
) {
  const search = new URLSearchParams({
    limit: String(limit),
  });
  if (role === "host") {
    search.set("hostId", participantId);
  } else {
    search.set("userId", participantId);
  }
  if (cursor) {
    search.set("cursor", cursor);
  }
  return apiRequest<CallsResponse>(`/calls?${search.toString()}`, {
    baseUrl,
  });
}

export async function startCall(
  actorId: string,
  counterpartId: string,
  baseUrl: string,
  actorRole: AppRole = "user"
) {
  return apiRequest<CallRecord>("/calls/start", {
    method: "POST",
    baseUrl,
    body: {
      requesterId: actorId,
      requesterRole: actorRole,
      counterpartId,
    },
  });
}

export async function updateCallState(
  callId: string,
  actorId: string,
  state: CallState,
  baseUrl: string,
  actorRole: AppRole = "user"
) {
  return apiRequest<CallRecord>(`/calls/${callId}/state`, {
    method: "POST",
    baseUrl,
    body: { actorId, actorRole, state },
  });
}
