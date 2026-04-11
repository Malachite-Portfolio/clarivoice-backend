import { create } from "zustand";
import { CallRecord } from "../types/models";

type HostCallState = {
  incomingCall: CallRecord | null;
  setIncomingCall: (value: CallRecord | null) => void;
  clearIncomingCall: () => void;
};

export const useHostCallStore = create<HostCallState>((set) => ({
  incomingCall: null,
  setIncomingCall: (value) => set({ incomingCall: value }),
  clearIncomingCall: () => set({ incomingCall: null }),
}));

