import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { AppButton } from "../../components/ui/AppButton";
import { PillChip } from "../../components/ui/PillChip";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { SectionCard } from "../../components/ui/SectionCard";
import { colors, typography } from "../../config/theme";
import { MIN_CALL_START_COINS, startCall } from "../../services/callService";
import { startConversation } from "../../services/chatService";
import { fetchHostProfile } from "../../services/hostService";
import { subscribeRealtime } from "../../services/realtimeService";
import { blockHost, reportHost, unblockHost } from "../../services/safetyService";
import { fetchWallet } from "../../services/walletService";
import { useSessionStore } from "../../store/useSessionStore";
import { useWalletStore } from "../../store/useWalletStore";
import { Host } from "../../types/models";
import { RootStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "HostProfile">;

export function HostProfileScreen({ navigation, route }: Props) {
  const { hostId } = route.params;
  const { session, apiBaseUrl } = useSessionStore();
  const { setWallet } = useWalletStore();
  const [host, setHost] = useState<Host | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"chat" | "call" | "block" | "unblock" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user.id ?? "";

  const loadProfile = useCallback(async () => {
    if (!userId) {
      return;
    }
    setError(null);
    try {
      const profile = await fetchHostProfile(hostId, apiBaseUrl, userId);
      setHost(profile);
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "Could not load host profile.");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, hostId, userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadProfile();
      const unsubscribe = subscribeRealtime((event) => {
        if (event.type === "host.availability.updated" && event.payload.hostId === hostId) {
          setHost((prev) =>
            prev
              ? {
                  ...prev,
                  availability: event.payload.availability,
                  isOnline: event.payload.availability === "online",
                  isCallAvailable:
                    event.payload.availability === "online" &&
                    !Boolean(prev.blocked || prev.blockedByHost || prev.blockedByUser),
                }
              : prev
          );
        }
        if (event.type === "safety.block.updated" && event.payload.userId === userId && event.payload.hostId === hostId) {
          const blocked = event.payload.blockedByUser || event.payload.blockedByHost;
          setHost((prev) =>
            prev
              ? {
                  ...prev,
                  blocked,
                  blockedByUser: event.payload.blockedByUser,
                  blockedByHost: event.payload.blockedByHost,
                  isCallAvailable: !blocked && prev.availability === "online",
                  isMessageAvailable: !blocked,
                }
              : prev
          );
        }
      });
      const pollId = setInterval(() => {
        loadProfile();
      }, 7000);

      return () => {
        clearInterval(pollId);
        unsubscribe();
      };
    }, [hostId, loadProfile, userId])
  );

  async function handleStartChat() {
    if (!session?.user.id || !host) {
      return;
    }
    const blocked = Boolean(host.blocked || host.blockedByHost || host.blockedByUser);
    if (blocked || host.isMessageAvailable === false) {
      setError("This host is unavailable due to safety settings.");
      return;
    }
    setBusyAction("chat");
    setError(null);
    try {
      const conversation = await startConversation(session.user.id, host.id, apiBaseUrl);
      navigation.navigate("ChatThread", {
        conversationId: conversation.id,
        hostId: conversation.hostId,
        hostName: conversation.hostName,
        hostAvatarUrl: conversation.hostAvatarUrl,
        hostVerified: conversation.hostVerified,
      });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start chat.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleStartCall() {
    if (!session?.user.id || !host) {
      return;
    }
    const blocked = Boolean(host.blocked || host.blockedByHost || host.blockedByUser);
    if (blocked) {
      setError("This host is blocked for your account.");
      return;
    }
    if (host.availability !== "online" || host.isCallAvailable === false) {
      setError("Host is offline right now.");
      return;
    }
    const latestWallet = await fetchWallet(session.user.id, apiBaseUrl);
    setWallet(latestWallet);
    if ((latestWallet.balance ?? 0) < MIN_CALL_START_COINS) {
      setError(`You need at least ${MIN_CALL_START_COINS} coins to start a call.`);
      return;
    }
    setBusyAction("call");
    setError(null);
    try {
      const call = await startCall(session.user.id, host.id, apiBaseUrl, "user");
      navigation.navigate("CallSession", {
        callId: call.id,
        hostId: call.hostId,
        hostName: call.hostName,
        hostAvatarUrl: call.hostAvatarUrl,
      });
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : "Could not start call.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleBlock() {
    if (!userId || !host) {
      return;
    }
    const blockedByUser = Boolean(host.blockedByUser);
    setBusyAction(blockedByUser ? "unblock" : "block");
    setError(null);
    try {
      if (blockedByUser) {
        await unblockHost(userId, host.id, apiBaseUrl);
      } else {
        await blockHost(userId, host.id, apiBaseUrl);
      }
      await loadProfile();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Could not update safety state.");
    } finally {
      setBusyAction(null);
    }
  }

  function handleReportHost() {
    if (!userId || !host) {
      return;
    }
    Alert.alert("Report Host", "Submit a report for moderation review?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        style: "destructive",
        onPress: async () => {
          try {
            await reportHost(userId, host.id, "Inappropriate behavior", apiBaseUrl);
            Alert.alert("Report submitted", "Moderation has been notified.");
          } catch (reportError) {
            setError(reportError instanceof Error ? reportError.message : "Could not submit report.");
          }
        },
      },
    ]);
  }

  return (
    <ScreenContainer>
      <AppHeader title="Host Profile" onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brandStart} />
        </View>
      ) : host ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {host.blocked || host.blockedByHost || host.blockedByUser ? (
            <SectionCard>
              <View style={styles.blockedRow}>
                <Ionicons name="shield-outline" size={16} color={colors.helpText} />
                <Text style={styles.blockedText}>
                  {host.blockedByUser
                    ? "You have blocked this host. Messaging and calls are disabled."
                    : "This host is unavailable for you right now."}
                </Text>
              </View>
            </SectionCard>
          ) : host.availability !== "online" ? (
            <SectionCard>
              <View style={styles.blockedRow}>
                <Ionicons name="time-outline" size={16} color={colors.helpText} />
                <Text style={styles.blockedText}>
                  Host is currently {host.availability}. Calls will be enabled when the host is online.
                </Text>
              </View>
            </SectionCard>
          ) : null}

          <SectionCard>
            <View style={styles.headerRow}>
              <Image source={{ uri: host.avatarUrl }} style={styles.avatar} />
              <View style={styles.headerText}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{host.name}</Text>
                  {host.verified ? (
                    <MaterialCommunityIcons name="check-decagram" size={16} color="#0E7490" />
                  ) : null}
                </View>
                <Text style={styles.meta}>{host.age} years · {host.languages.join(", ")}</Text>
                <View style={styles.onlineRow}>
                  <View
                    style={[
                      styles.onlineDot,
                      { backgroundColor: host.isOnline ? colors.success : colors.muted },
                    ]}
                  />
                  <Text style={styles.onlineText}>
                    {host.isOnline ? "Online now" : `Status: ${host.availability}`}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.about}>{host.about}</Text>
          </SectionCard>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Expertise</Text>
            <View style={styles.chips}>
              {host.interests.map((item) => (
                <PillChip key={item} label={item} />
              ))}
            </View>
          </View>

          <SectionCard>
            <View style={styles.safeRow}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.helpText} />
              <Text style={styles.safeText}>
                You can report or block anytime from chat for a safer experience.
              </Text>
            </View>
            <View style={styles.safeActions}>
              <AppButton
                label={host.blockedByUser ? "Unblock Host" : "Block Host"}
                onPress={handleToggleBlock}
                variant={host.blockedByUser ? "outline" : "primary"}
                loading={busyAction === "block" || busyAction === "unblock"}
                style={styles.safeActionButton}
              />
              <AppButton
                label="Report"
                onPress={handleReportHost}
                variant="outline"
                style={styles.safeActionButton}
              />
            </View>
          </SectionCard>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <AppButton
              label="Start Chat"
              onPress={handleStartChat}
              loading={busyAction === "chat"}
              disabled={Boolean(host.blocked || host.blockedByHost || host.blockedByUser)}
            />
            <AppButton
              label="Start Call"
              onPress={handleStartCall}
              variant="outline"
              loading={busyAction === "call"}
              style={styles.callButton}
              disabled={
                Boolean(host.blocked || host.blockedByHost || host.blockedByUser) ||
                host.availability !== "online" ||
                host.isCallAvailable === false
              }
            />
          </View>
        </ScrollView>
      ) : (
        <View style={styles.loader}>
          <Text style={styles.error}>Host profile is unavailable.</Text>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1.5,
    borderColor: "#F89BB4",
  },
  headerText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },
  name: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.body,
    color: colors.textSecondary,
  },
  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  onlineText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  about: {
    ...typography.body,
    color: colors.textPrimary,
    marginTop: 12,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: 8,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  safeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  safeText: {
    ...typography.caption,
    color: colors.helpText,
    flex: 1,
    lineHeight: 17,
  },
  safeActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  safeActionButton: {
    flex: 1,
  },
  blockedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  blockedText: {
    ...typography.caption,
    color: colors.helpText,
    flex: 1,
    lineHeight: 17,
  },
  actions: {
    marginTop: 14,
    marginBottom: 22,
    gap: 8,
  },
  callButton: {
    marginTop: 2,
  },
  error: {
    color: colors.danger,
    marginTop: 10,
  },
});
