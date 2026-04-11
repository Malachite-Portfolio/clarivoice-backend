import * as Notifications from "expo-notifications";
import { Linking, PermissionsAndroid, Platform } from "react-native";

export type AppPermissionStatus = "unknown" | "granted" | "denied" | "blocked" | "unavailable";
type AndroidPermission = (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS];

type RuntimePermissionDescriptor = {
  permission: AndroidPermission;
  title: string;
  message: string;
  buttonPositive: string;
};

function mapRuntimePermissionResult(result: string): AppPermissionStatus {
  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return "granted";
  }
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    return "blocked";
  }
  return "denied";
}

async function getAndroidRuntimePermissionStatus(
  permission: AndroidPermission
): Promise<AppPermissionStatus> {
  if (Platform.OS !== "android") {
    return "granted";
  }

  try {
    const granted = await PermissionsAndroid.check(permission);
    return granted ? "granted" : "denied";
  } catch (error) {
    console.error("[permissions] check failed", {
      permission,
      error: error instanceof Error ? error.message : String(error),
    });
    return "unavailable";
  }
}

async function requestAndroidRuntimePermission(
  descriptor: RuntimePermissionDescriptor
): Promise<AppPermissionStatus> {
  if (Platform.OS !== "android") {
    return "granted";
  }

  try {
    const result = await PermissionsAndroid.request(descriptor.permission, {
      title: descriptor.title,
      message: descriptor.message,
      buttonPositive: descriptor.buttonPositive,
      buttonNegative: "Not now",
    });
    return mapRuntimePermissionResult(result);
  } catch (error) {
    console.error("[permissions] request failed", {
      permission: descriptor.permission,
      error: error instanceof Error ? error.message : String(error),
    });
    return "unavailable";
  }
}

export async function getNotificationPermissionStatus(): Promise<AppPermissionStatus> {
  if (Platform.OS !== "android") {
    return "granted";
  }

  if (Platform.Version < 33) {
    return "granted";
  }

  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) {
      return "granted";
    }
    return settings.canAskAgain ? "denied" : "blocked";
  } catch (error) {
    console.error("[permissions] notification status failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return "unavailable";
  }
}

export async function requestNotificationPermission(): Promise<AppPermissionStatus> {
  if (Platform.OS !== "android") {
    return "granted";
  }

  if (Platform.Version < 33) {
    return "granted";
  }

  try {
    const settings = await Notifications.requestPermissionsAsync();
    if (settings.granted) {
      return "granted";
    }
    return settings.canAskAgain ? "denied" : "blocked";
  } catch (error) {
    console.error("[permissions] notification request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return "unavailable";
  }
}

export function getMicrophonePermissionStatus() {
  return getAndroidRuntimePermissionStatus(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
}

export function requestMicrophonePermission() {
  return requestAndroidRuntimePermission({
    permission: PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    title: "Allow microphone access",
    message: "Microphone access is needed so your voice can be heard during audio calls.",
    buttonPositive: "Allow",
  });
}

export function getCameraPermissionStatus() {
  return getAndroidRuntimePermissionStatus(PermissionsAndroid.PERMISSIONS.CAMERA);
}

export function requestCameraPermission() {
  return requestAndroidRuntimePermission({
    permission: PermissionsAndroid.PERMISSIONS.CAMERA,
    title: "Allow camera access",
    message: "Camera access will be used only if video calling is enabled later.",
    buttonPositive: "Allow",
  });
}

export async function refreshPermissionStatuses() {
  const [notificationStatus, microphoneStatus, cameraStatus] = await Promise.all([
    getNotificationPermissionStatus(),
    getMicrophonePermissionStatus(),
    getCameraPermissionStatus(),
  ]);

  return {
    notificationStatus,
    microphoneStatus,
    cameraStatus,
  };
}

export async function openAppSettings() {
  try {
    await Linking.openSettings();
  } catch (error) {
    console.error("[permissions] open settings failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function isPermissionGranted(status: AppPermissionStatus) {
  return status === "granted";
}
