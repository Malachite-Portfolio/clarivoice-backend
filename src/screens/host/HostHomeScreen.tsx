import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HostStatusToggle } from "../../components/host/HostStatusToggle";
import { HostSummaryCard } from "../../components/host/HostSummaryCard";
import { EmptyState } from "../../components/EmptyState";
import { colors } from "../../config/theme";
import {
  fetchHostCalls,
  fetchHostConversations,
  fetchHostDashboard,
  fetchHostUsers,
  startHostConversation,
  updateHostAvailability,
} from "../../services/hostService";
import { subscribeRealtime } from "../../services/realtimeService";
import { useSessionStore } from "../../store/useSessionStore";
import { AvailabilityStatus, HostDashboard } from "../../types/models";
import { RootStackParamList } from "../../types/navigation";
import { shortDateTime } from "../../utils/format";

type QueueUser = {
  id: string;
  displayName: string;
  avatarUrl: string;
};

export function HostHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session, apiBaseUrl } = useSessionStore();
  const [dashboard, setDashboard] = useState<HostDashboard | null>(null);
  const [users, setUsers] = useState<QueueUser[]>([]);
  const [recentItems, setRecentItems] = useState<Array<{ id: string; label: string; at: string }>>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [savingAvailability, setSavingAvailability] = useState<AvailabilityStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hostId = session?.user.id ?? "";

  const loadData = useCallback(async () => {
    if (!hostId) {
      return;
    }
    setError(null);
    try {
      const [dashboardResponse, usersResponse, chatsResponse, callsResponse] = await Promise.all([
        fetchHostDashboard(hostId, apiBaseUrl),
        fetchHostUsers(hostId, apiBaseUrl),
        fetchHostConversations(hostId, apiBaseUrl, undefined, 5),
        fetchHostCalls(hostId, apiBaseUrl, undefined, 5),
      ]);
      setDashboard(dashboardResponse);
      setUsers(usersResponse);

      const chatItems = chatsResponse.items.map((item) => ({
        id: `chat-${item.id}`,
        label: `Chat: ${item.userName}`,
        at: item.lastMessageAt,
      }));
      const callItems = callsResponse.items.map((item) => ({
        id: `call-${item.id}`,
        label: `Call: ${item.userName} (${item.state})`,
        at: item.startedAt,
      }));

      setRecentItems(
        [...chatItems, ...callItems]
          .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
          .slice(0, 5)
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load host dashboard.");
    } finally {
      setLoading(false);
      setSavingAvailability(null);
    }
  }, [apiBaseUrl, hostId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
      const unsubscribe = subscribeRealtime((event) => {
        if (event.type === "host.availability.updated" && event.payload.hostId === hostId) {
          setDashboard((prev) =>
            prev ? { ...prev, availability: event.payload.availability } : prev
          );
        }
        if (
          (event.type === "conversation.updated" && event.payload.roleView === "host") ||
          (event.type === "call.updated" && event.payload.hostId === hostId) ||
          (event.type === "safety.block.updated" && event.payload.hostId === hostId)
        ) {
          loadData();
        }
      });
      const pollId = setInterval(() => {
        loadData();
      }, 7000);
      return () => {
        clearInterval(pollId);
        unsubscribe();
      };
    }, [hostId, loadData])
  );

  async function handleAvailabilityChange(next: AvailabilityStatus) {
    if (!hostId || dashboard?.availability === next || savingAvailability) {
      return;
    }
    setSavingAvailability(next);
    try {
      await updateHostAvailability(hostId, next, apiBaseUrl);
      setDashboard((prev) => (prev ? { ...prev, availability: next } : prev));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update availability.");
    } finally {
      setSavingAvailability(null);
    }
  }

  async function openConversation(user: QueueUser) {
    if (!hostId || dashboard?.availability !== "online") {
      setError("Set your status to online before taking new users.");
      return;
    }
    try {
      const preview = await startHostConversation(hostId, user.id, apiBaseUrl);
      navigation.navigate("HostChatThread", {
        conversationId: preview.id,
        userId: preview.userId,
        userName: preview.userName,
        userAvatarUrl: preview.userAvatarUrl,
      });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not open conversation.");
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Host Dashboard</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.secondaryHeaderButton}
            onPress={() => navigation.navigate("HostActivity")}
          >
            <Ionicons name="time-outline" size={14} color="#BE123C" />
            <Text style={styles.secondaryHeaderText}>Activity</Text>
          </Pressable>
          <Pressable style={styles.earningsButton} onPress={() => navigation.navigate("HostEarnings")}>
            <Ionicons name="wallet-outline" size={14} color="#BE123C" />
            <Text style={styles.earningsButtonText}>Earnings</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.subtitle}>
        Stay available for meaningful conversations and support users in real time.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <HostStatusToggle
        value={dashboard?.availability ?? "offline"}
        loading={savingAvailability}
        onChange={handleAvailabilityChange}
      />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brandStart} />
        </View>
      ) : (
        <>
          {dashboard?.availability !== "online" ? (
            <View style={styles.offlineBanner}>
              <Ionicons name="pause-circle-outline" size={15} color={colors.helpText} />
              <Text style={styles.offlineText}>
                You are currently offline. Switch to online to accept new users and calls.
              </Text>
            </View>
          ) : null}

          <View style={styles.metrics}>
            <HostSummaryCard
              title="Active chats"
              value={dashboard?.activeConversations ?? 0}
              icon="chatbubble-ellipses-outline"
            />
            <HostSummaryCard
              title="Unread"
              value={dashboard?.unreadMessages ?? 0}
              icon="mail-unread-outline"
            />
            <HostSummaryCard
              title="Live calls"
              value={dashboard?.ongoingCalls ?? 0}
              icon="call-outline"
            />
          </View>

          <Text style={styles.sectionTitle}>Recent activity</Text>
          {recentItems.length === 0 ? (
            <Text style={styles.subtle}>No activity yet.</Text>
          ) : (
            <View style={styles.activityList}>
              {recentItems.map((item) => (
                <View key={item.id} style={styles.activityRow}>
                  <Text style={styles.activityLabel}>{item.label}</Text>
                  <Text style={styles.activityTime}>{shortDateTime(item.at)}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>Users needing support</Text>
          {users.length === 0 ? (
            <EmptyState
              title="No pending users"
              subtitle="New users will appear here when they begin a conversation with you."
            />
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.userList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.userRow,
                    dashboard?.availability !== "online" && styles.userRowDisabled,
                  ]}
                  onPress={() => openConversation(item)}
                  disabled={dashboard?.availability !== "online"}
                >
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                  <View style={styles.userMeta}>
                    <Text style={styles.userName}>{item.displayName}</Text>
                    <Text style={styles.userHint}>Open chat</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>
              )}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: 10,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  secondaryHeaderButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#F8CBD7",
    backgroundColor: "#FFF2F7",
    paddingHorizontal: 10,
    height: 28,
  },
  secondaryHeaderText: {
    color: "#BE123C",
    fontSize: 12,
    fontWeight: "700",
  },
  earningsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#F8CBD7",
    backgroundColor: "#FFF2F7",
    paddingHorizontal: 10,
    height: 28,
  },
  earningsButtonText: {
    color: "#BE123C",
    fontSize: 12,
    fontWeight: "700",
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFD0DE",
    backgroundColor: colors.helpBg,
    padding: 10,
    marginBottom: 10,
  },
  offlineText: {
    flex: 1,
    color: colors.helpText,
    fontSize: 12,
    lineHeight: 17,
  },
  metrics: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 12,
  },
  activityList: {
    marginBottom: 12,
  },
  activityRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  activityLabel: {
    color: colors.textPrimary,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
    fontSize: 12,
  },
  activityTime: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  userList: {
    paddingBottom: 14,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10,
    marginBottom: 8,
  },
  userRowDisabled: {
    opacity: 0.45,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  userMeta: {
    flex: 1,
    marginHorizontal: 10,
  },
  userName: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  userHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  error: {
    color: colors.danger,
    marginBottom: 6,
  },
});
