import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getAppRole, getDefaultApiBaseUrl } from "../config/runtime";
import { AppRole, AuthSession, OtpSession } from "../types/models";

type SessionState = {
  hydrated: boolean;
  appRole: AppRole;
  session: AuthSession | null;
  otpSession: OtpSession | null;
  hasSeenOnboarding: boolean;
  apiBaseUrl: string;
  setHydrated: (value: boolean) => void;
  setHasSeenOnboarding: (value: boolean) => void;
  setSession: (value: AuthSession | null) => void;
  setOtpSession: (value: OtpSession | null) => void;
  updateDisplayName: (value: string) => void;
  logout: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      hydrated: false,
      appRole: getAppRole(),
      session: null,
      otpSession: null,
      hasSeenOnboarding: false,
      apiBaseUrl: getDefaultApiBaseUrl(),
      setHydrated: (value) => set({ hydrated: value }),
      setHasSeenOnboarding: (value) => set({ hasSeenOnboarding: value }),
      setSession: (value) => set({ session: value }),
      setOtpSession: (value) => set({ otpSession: value }),
      updateDisplayName: (value) =>
        set((state) =>
          state.session
            ? {
                session: {
                  ...state.session,
                  user: {
                    ...state.session.user,
                    displayName: value,
                  },
                },
              }
            : state
        ),
      logout: () => set({ session: null, otpSession: null }),
    }),
    {
      name: "feely-session-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        appRole: state.appRole,
        session: state.session,
        hasSeenOnboarding: state.hasSeenOnboarding,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<SessionState> | null;
        if (!persisted) {
          return currentState;
        }
        return {
          ...currentState,
          ...persisted,
          apiBaseUrl: currentState.apiBaseUrl,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
