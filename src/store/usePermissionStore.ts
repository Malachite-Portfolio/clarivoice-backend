import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { AppPermissionStatus } from "../services/permissionsService";

type PermissionState = {
  notificationStatus: AppPermissionStatus;
  microphoneStatus: AppPermissionStatus;
  cameraStatus: AppPermissionStatus;
  notificationPrompted: boolean;
  setStatuses: (value: Partial<Pick<PermissionState, "notificationStatus" | "microphoneStatus" | "cameraStatus">>) => void;
  setNotificationPrompted: (value: boolean) => void;
  resetPromptState: () => void;
};

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set) => ({
      notificationStatus: "unknown",
      microphoneStatus: "unknown",
      cameraStatus: "unknown",
      notificationPrompted: false,
      setStatuses: (value) => set(value),
      setNotificationPrompted: (value) => set({ notificationPrompted: value }),
      resetPromptState: () => set({ notificationPrompted: false }),
    }),
    {
      name: "feely-permissions-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        notificationStatus: state.notificationStatus,
        microphoneStatus: state.microphoneStatus,
        cameraStatus: state.cameraStatus,
        notificationPrompted: state.notificationPrompted,
      }),
    }
  )
);
