import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../config/theme";
import { fetchCalls, startCall, updateCallState } from "../../services/callService";
import {
  activateVoiceCallAudio,
  deactivateVoiceCallAudio,
  setSpeakerphoneEnabled,
} from "../../services/callAudioService";
import { callUiStateLabel, deriveCallUiState } from "../../services/callUiState";
import {
  getMicrophonePermissionStatus,
  openAppSettings,
  requestMicrophonePermission,
} from "../../services/permissionsService";
import { subscribeRealtime } from "../../services/realtimeService";
import { usePermissionStore } from "../../store/usePermissionStore";
import { useSessionStore } from "../../store/useSessionStore";
import { useWalletStore } from "../../store/useWalletStore";
import { CallRecord } from "../../types/models";
import { RootStackParamList } from "../../types/navigation";
import { callDuration, shortDateTime } from "../../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "CallSession">;

export function CallSessionScreen({ route, navigation }: Props) {
  const { hostAvatarUrl, hostId, hostName, callId } = route.params;
  const { session, apiBaseUrl } = useSessionStore();
  const { wallet } = useWalletStore();
  const { setStatuses } = usePermissionStore();
  const [call, setCall] = useState<CallRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);

  const userId = session?.user.id ?? "";

  const stateText = useMemo(() => {
    const uiState = deriveCallUiState({
      call,
      role: "user",
    });
    return callUiStateLabel(uiState);
  }, [call]);

  const activeDuration = useMemo(() => {
    if (!call) {
      return "00:00";
    }
    return callDuration(call.durationSec);
  }, [call]);

  const chargedCoins = call?.chargedCoins ?? (call?.billedMinutes ?? 0) * 50;

  const ensureMicPermission = useCallback(async () => {
    const currentStatus = await getMicrophonePermissionStatus();
    setStatuses({ microphoneStatus: currentStatus });

    if (currentStatus === "granted") {
      return true;
    }

    if (currentStatus === "blocked") {
      Alert.alert(
        "Microphone required",
        "Microphone access is blocked. Open app settings to join voice calls.",
        [
          { text: "Later", style: "cancel" },
          { text: "Open settings", onPress: () => openAppSettings() },
        ]
      );
      return false;
    }

    const nextStatus = await requestMicrophonePermission();
    setStatuses({ microphoneStatus: nextStatus });
    if (nextStatus === "granted") {
      return true;
    }

    Alert.alert(
      "Microphone required",
      nextStatus === "blocked"
        ? "Microphone access is blocked. Open app settings to join voice calls."
        : "Microphone access is needed before you can join a call.",
      [
        { text: "Not now", style: "cancel" },
        ...(nextStatus === "blocked"
          ? [{ text: "Open settings", onPress: () => openAppSettings() }]
          : []),
      ]
    );
    return false;
  }, [setStatuses]);

  const initCall = useCallback(async () => {
    if (!userId) {
      return;
    }
    setError(null);
    try {
      const hasMicPermission = await ensureMicPermission();
      if (!hasMicPermission) {
        setError("Microphone access is required before starting a call.");
        return;
      }

      await activateVoiceCallAudio(false);
      if (callId) {
        const calls = await fetchCalls(userId, apiBaseUrl, undefined, 40, "user");
        const found = calls.items.find((item) => item.id === callId) ?? null;
        if (!found) {
          setError("Call not found.");
          setCall(null);
        } else {
          setCall(found);
        }
      } else {
        const started = await startCall(userId, hostId, apiBaseUrl, "user");
        setCall(started);
      }
    } catch (initError) {
      setError(initError instanceof Error ? initError.message : "Could not start call.");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, callId, ensureMicPermission, hostId, userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      initCall();
      const unsubscribe = subscribeRealtime((event) => {
        if (event.type === "call.updated") {
          setCall((prev) => {
            if (!prev) {
              return event.payload;
            }
            if (prev.id !== event.payload.id) {
              return prev;
            }
            return event.payload;
          });
        }
      });
      const pollId = setInterval(async () => {
        if (!userId) {
          return;
        }
        try {
          if (callId) {
            const calls = await fetchCalls(userId, apiBaseUrl, undefined, 40, "user");
            const found = calls.items.find((item) => item.id === callId);
            if (found) {
              setCall(found);
            }
          }
        } catch {
          // polling fallback best-effort
        }
      }, 5000);
      return () => {
        clearInterval(pollId);
        unsubscribe();
        deactivateVoiceCallAudio();
      };
    }, [initCall])
  );

  async function handleEndCall() {
    if (!call) {
      navigation.goBack();
      return;
    }
    try {
      const ended = await updateCallState(call.id, userId, "ended", apiBaseUrl, "user");
      setCall(ended);
      await deactivateVoiceCallAudio();
    } catch (endError) {
      setError(endError instanceof Error ? endError.message : "Could not end call.");
    }
  }

  async function handleCallAgain() {
    if (!userId) {
      return;
    }
    try {
      const hasMicPermission = await ensureMicPermission();
      if (!hasMicPermission) {
        setError("Microphone access is required before calling again.");
        return;
      }

      await activateVoiceCallAudio(speakerOn);
      const started = await startCall(userId, hostId, apiBaseUrl, "user");
      setCall(started);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not call again.");
    }
  }

  async function handleSpeakerToggle() {
    const next = !speakerOn;
    setSpeakerOn(next);
    await setSpeakerphoneEnabled(next);
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.topBackButton}>
          <Ionicons name="chevron-back" size={22} color="#F9FAFB" />
        </Pressable>
        <Text style={styles.topTitle}>Audio Call</Text>
        <View style={styles.topRightSpacer} />
      </View>

      <View style={styles.center}>
        <Image source={{ uri: hostAvatarUrl }} style={styles.avatar} />
        <Text style={styles.name}>{hostName}</Text>
        <Text style={styles.state}>{loading ? "Starting call..." : stateText}</Text>
        <Text style={styles.time}>{call ? shortDateTime(call.startedAt) : ""}</Text>
        <Text style={styles.duration}>{activeDuration}</Text>
        <Text style={styles.charge}>Charged: {chargedCoins} coins</Text>
        <Text style={styles.balance}>Balance: {wallet?.balance ?? 0} coins</Text>
        <View style={styles.controlsRow}>
          <Pressable
            style={[styles.roundControl, muted && styles.roundControlActive]}
            onPress={() => setMuted((prev) => !prev)}
          >
            <Ionicons
              name={muted ? "mic-off-outline" : "mic-outline"}
              size={20}
              color={muted ? "#FFFFFF" : colors.textPrimary}
            />
          </Pressable>
          <Pressable
            style={[styles.roundControl, speakerOn && styles.roundControlActive]}
            onPress={handleSpeakerToggle}
          >
            <Ionicons
              name={speakerOn ? "volume-high-outline" : "volume-medium-outline"}
              size={20}
              color={speakerOn ? "#FFFFFF" : colors.textPrimary}
            />
          </Pressable>
        </View>

        <View style={styles.hints}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.helpText} />
          <Text style={styles.hintText}>
            You can end, report, or block anytime if the conversation feels unsafe.
          </Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.footer}>
          <ActivityIndicator color={colors.brandStart} />
        </View>
      ) : call?.state === "connected" ||
        call?.state === "calling" ||
        call?.state === "ringing" ||
        call?.state === "accepted" ||
        call?.state === "connecting" ? (
        <Pressable style={styles.footer} onPress={handleEndCall}>
          <LinearGradient
            colors={["#B91C1C", "#EF4444"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.endButton}
          >
            <Ionicons name="call" size={18} color="#FFFFFF" />
            <Text style={styles.endText}>End Call</Text>
          </LinearGradient>
        </Pressable>
      ) : (
        <Pressable style={styles.footer} onPress={handleCallAgain}>
          <LinearGradient
            colors={[colors.brandStart, colors.brandEnd]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.endButton}
          >
            <Ionicons name="call-outline" size={18} color="#FFFFFF" />
            <Text style={styles.endText}>Call Again</Text>
          </LinearGradient>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#090B10",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 20,
  },
  topBar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  topBackButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  topTitle: {
    flex: 1,
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 4,
  },
  topRightSpacer: {
    width: 36,
    height: 36,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: "#374151",
    marginBottom: 14,
  },
  name: {
    color: "#F9FAFB",
    fontSize: 22,
    fontWeight: "800",
  },
  state: {
    marginTop: 8,
    color: "#D1D5DB",
    fontSize: 16,
    fontWeight: "600",
  },
  time: {
    marginTop: 6,
    color: "#9CA3AF",
    fontSize: 12,
  },
  duration: {
    marginTop: 8,
    color: "#FB7185",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 1,
  },
  charge: {
    marginTop: 6,
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "600",
  },
  balance: {
    marginTop: 2,
    color: "#9CA3AF",
    fontSize: 12,
  },
  hints: {
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
    backgroundColor: "#111827",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 22,
  },
  roundControl: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#374151",
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  roundControlActive: {
    borderColor: "#FB7185",
    backgroundColor: "#FB7185",
  },
  hintText: {
    flex: 1,
    color: "#9CA3AF",
    fontSize: 12,
    lineHeight: 17,
  },
  error: {
    color: colors.danger,
    textAlign: "center",
    marginBottom: 8,
  },
  footer: {
    minHeight: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  endButton: {
    height: 56,
    borderRadius: 999,
    minWidth: 220,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  endText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
});
