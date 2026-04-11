import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserPreferences = {
  notificationsEnabled: boolean;
  callSoundsEnabled: boolean;
  darkModeEnabled: boolean;
};

const KEY_PREFIX = "feely-preferences";

const defaultPreferences: UserPreferences = {
  notificationsEnabled: true,
  callSoundsEnabled: true,
  darkModeEnabled: false,
};

export async function loadPreferences(ownerId: string) {
  const raw = await AsyncStorage.getItem(`${KEY_PREFIX}:${ownerId}`);
  if (!raw) {
    return defaultPreferences;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      notificationsEnabled:
        typeof parsed.notificationsEnabled === "boolean"
          ? parsed.notificationsEnabled
          : defaultPreferences.notificationsEnabled,
      callSoundsEnabled:
        typeof parsed.callSoundsEnabled === "boolean"
          ? parsed.callSoundsEnabled
          : defaultPreferences.callSoundsEnabled,
      darkModeEnabled:
        typeof parsed.darkModeEnabled === "boolean"
          ? parsed.darkModeEnabled
          : defaultPreferences.darkModeEnabled,
    };
  } catch {
    return defaultPreferences;
  }
}

export async function savePreferences(ownerId: string, preferences: UserPreferences) {
  await AsyncStorage.setItem(`${KEY_PREFIX}:${ownerId}`, JSON.stringify(preferences));
  return preferences;
}

