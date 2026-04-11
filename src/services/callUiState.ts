import { AppRole, CallRecord } from "../types/models";

export type CallUiState =
  | "idle"
  | "outgoing"
  | "incoming"
  | "ringing"
  | "accepted"
  | "connected"
  | "declined"
  | "missed"
  | "ended"
  | "failed"
  | "offline-unavailable"
  | "blocked";

type DeriveCallUiStateInput = {
  call: CallRecord | null;
  role: AppRole;
  blocked?: boolean;
  unavailable?: boolean;
};

export function deriveCallUiState({
  call,
  role,
  blocked = false,
  unavailable = false,
}: DeriveCallUiStateInput): CallUiState {
  if (blocked) {
    return "blocked";
  }
  if (unavailable) {
    return "offline-unavailable";
  }
  if (!call) {
    return "idle";
  }

  if (call.state === "calling") {
    return call.initiatedByRole === role ? "outgoing" : "incoming";
  }
  if (call.state === "ringing") {
    return "ringing";
  }
  if (call.state === "accepted" || call.state === "connecting") {
    return "accepted";
  }
  if (call.state === "connected") {
    return "connected";
  }
  if (call.state === "declined") {
    return "declined";
  }
  if (call.state === "missed") {
    return "missed";
  }
  if (call.state === "ended") {
    return "ended";
  }
  return "failed";
}

export function callUiStateLabel(state: CallUiState) {
  if (state === "idle") return "Preparing call...";
  if (state === "outgoing") return "Calling...";
  if (state === "incoming") return "Incoming call";
  if (state === "ringing") return "Ringing...";
  if (state === "accepted") return "Connecting...";
  if (state === "connected") return "Connected";
  if (state === "declined") return "Declined";
  if (state === "missed") return "Missed";
  if (state === "ended") return "Call ended";
  if (state === "offline-unavailable") return "Host offline";
  if (state === "blocked") return "Blocked";
  return "Failed";
}
