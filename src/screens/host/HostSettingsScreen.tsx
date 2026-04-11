import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View } from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { PermissionStatusCard } from "../../components/ui/PermissionStatusCard";
import { AppButton } from "../../components/ui/AppButton";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { SectionCard } from "../../components/ui/SectionCard";
import { colors } from "../../config/theme";
import { loadPreferences, savePreferences, UserPreferences } from "../../services/preferencesService";
import {
  openAppSettings,
  refreshPermissionStatuses,
  requestMicrophonePermission,
  requestNotificationPermission,
} from "../../services/permissionsService";
import { usePermissionStore } from "../../store/usePermissionStore";
import { useSessionStore } from "../../store/useSessionStore";
import { RootStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "HostSettings">;

export function HostSettingsScreen({ navigation }: Props) {
  const { session } = useSessionStore();
  const { notificationStatus, microphoneStatus, setStatuses, setNotificationPrompted } =
    usePermissionStore();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const hostId = session?.user.id ?? "";

  useFocusEffect(
    useCallback(() => {
      if (!hostId) {
        return;
      }
      setLoading(true);
      loadPreferences(hostId)
        .then((result) => setPreferences(result))
        .finally(() => setLoading(false));
      refreshPermissionStatuses()
        .then((statuses) => setStatuses(statuses))
        .catch((error) => {
          console.error("[permissions] host settings refresh failed", error);
        });
    }, [hostId])
  );

  function togglePreference<K extends keyof UserPreferences>(key: K) {
    setPreferences((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        [key]: !prev[key],
      };
    });
  }

  async function handleSave() {
    if (!hostId || !preferences) {
      return;
    }
    setSaving(true);
    try {
      await savePreferences(hostId, preferences);
      Alert.alert("Saved", "Host settings updated.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Could not save", error instanceof Error ? error.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleNotificationPermission() {
    if (notificationStatus === "blocked") {
      await openAppSettings();
      return;
    }

    const nextStatus = await requestNotificationPermission();
    setStatuses({ notificationStatus: nextStatus });
    setNotificationPrompted(true);

    if (nextStatus === "blocked") {
      Alert.alert(
        "Notifications are blocked",
        "Open app settings to enable incoming chats and calls.",
        [
          { text: "Later", style: "cancel" },
          { text: "Open settings", onPress: () => openAppSettings() },
        ]
      );
    }
  }

  async function handleMicrophonePermission() {
    if (microphoneStatus === "blocked") {
      await openAppSettings();
      return;
    }

    const nextStatus = await requestMicrophonePermission();
    setStatuses({ microphoneStatus: nextStatus });

    if (nextStatus === "blocked") {
      Alert.alert(
        "Microphone is blocked",
        "Open app settings to allow incoming calls to use the host microphone.",
        [
          { text: "Later", style: "cancel" },
          { text: "Open settings", onPress: () => openAppSettings() },
        ]
      );
    }
  }

  return (
    <ScreenContainer>
      <AppHeader title="Host Settings" onBack={() => navigation.goBack()} />
      {loading || !preferences ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brandStart} />
        </View>
      ) : (
        <View style={styles.content}>
          <SectionCard>
            <Text style={styles.sectionTitle}>Alerts</Text>
            <SettingRow
              label="Incoming chat alerts"
              value={preferences.notificationsEnabled}
              onChange={() => togglePreference("notificationsEnabled")}
            />
            <SettingRow
              label="Call ringtone"
              value={preferences.callSoundsEnabled}
              onChange={() => togglePreference("callSoundsEnabled")}
            />
            <View style={styles.permissionStack}>
              <PermissionStatusCard
                title="System notification permission"
                description="Needed for incoming chats and high-priority call alerts while you are available."
                status={notificationStatus}
                actionLabel={notificationStatus === "granted" ? undefined : notificationStatus === "blocked" ? "Open settings" : "Allow"}
                onActionPress={
                  notificationStatus === "granted" ? undefined : handleNotificationPermission
                }
              />
              <PermissionStatusCard
                title="Microphone permission"
                description="Needed before accepting or starting a host audio call."
                status={microphoneStatus}
                actionLabel={microphoneStatus === "granted" ? undefined : microphoneStatus === "blocked" ? "Open settings" : "Allow"}
                onActionPress={
                  microphoneStatus === "granted" ? undefined : handleMicrophonePermission
                }
              />
            </View>
          </SectionCard>
          <SectionCard>
            <Text style={styles.sectionTitle}>Appearance</Text>
            <SettingRow
              label="Dark mode (placeholder)"
              value={preferences.darkModeEnabled}
              onChange={() => togglePreference("darkModeEnabled")}
            />
            <Text style={styles.caption}>
              Settings persistence is local and ready to move to host profile APIs later.
            </Text>
          </SectionCard>
          <AppButton label="Save Changes" onPress={handleSave} loading={saving} />
        </View>
      )}
    </ScreenContainer>
  );
}

function SettingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#E5E7EB", true: "#F8B4C8" }}
        thumbColor={value ? colors.brandStart : "#FFFFFF"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    gap: 10,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: "800",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  label: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  caption: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  permissionStack: {
    marginTop: 12,
    gap: 10,
  },
});
