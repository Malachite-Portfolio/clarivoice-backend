import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../components/EmptyState";
import { HostCard } from "../../components/HostCard";
import { colors } from "../../config/theme";
import { MIN_CALL_START_COINS, startCall } from "../../services/callService";
import { fetchHosts, startConversation } from "../../services/chatService";
import { subscribeRealtime } from "../../services/realtimeService";
import { fetchWallet } from "../../services/walletService";
import { useSessionStore } from "../../store/useSessionStore";
import { useWalletStore } from "../../store/useWalletStore";
import { Host } from "../../types/models";
import { RootStackParamList } from "../../types/navigation";

const TOPICS = [
  { id: "stress", title: "Stress Relief", keywords: ["stress", "anxiety", "overthinking"] },
  { id: "breakups", title: "Breakups", keywords: ["breakup", "confidence"] },
  { id: "motivation", title: "Motivation", keywords: ["motivation", "career"] },
  { id: "selfcare", title: "Self Care", keywords: ["self-care", "self care"] },
];

export function ExploreScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session, apiBaseUrl } = useSessionStore();
  const { setWallet } = useWalletStore();
  const [hosts, setHosts] = useState<Host[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("stress");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user.id ?? "";

  const loadHosts = useCallback(async () => {
    if (!userId) {
      return;
    }
    setError(null);
    try {
      const [hostsResponse, walletResponse] = await Promise.all([
        fetchHosts(userId, apiBaseUrl),
        fetchWallet(userId, apiBaseUrl),
      ]);
      setHosts(hostsResponse);
      setWallet(walletResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load explore list.");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, setWallet, userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadHosts();
      const unsubscribe = subscribeRealtime((event) => {
        if (event.type === "host.availability.updated") {
          setHosts((prev) =>
            prev.map((host) =>
              host.id === event.payload.hostId
                ? {
                    ...host,
                    availability: event.payload.availability,
                    isOnline: event.payload.availability === "online",
                    isCallAvailable: event.payload.availability === "online",
                  }
                : host
            )
          );
        }
        if (
          event.type === "wallet.updated" &&
          event.payload.ownerType === "user" &&
          event.payload.ownerId === userId
        ) {
          setWallet(event.payload);
        }
        if (event.type === "safety.block.updated" && event.payload.userId === userId) {
          if (event.payload.blockedByUser || event.payload.blockedByHost) {
            setHosts((prev) => prev.filter((host) => host.id !== event.payload.hostId));
          } else {
            loadHosts();
          }
        }
      });
      const pollId = setInterval(() => {
        loadHosts();
      }, 7000);
      return () => {
        clearInterval(pollId);
        unsubscribe();
      };
    }, [loadHosts, setWallet, userId])
  );

  const topic = TOPICS.find((item) => item.id === selectedTopicId) ?? TOPICS[0];
  const visibleHosts = useMemo(() => {
    return hosts.filter((host) => {
      const haystack = `${host.about} ${host.interests.join(" ")}`.toLowerCase();
      return topic.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
    });
  }, [hosts, topic.keywords]);

  async function handleTalkNow(host: Host) {
    if (!session) {
      return;
    }
    const isBlocked = Boolean(host.blocked || host.blockedByHost || host.blockedByUser);
    if (isBlocked || host.isMessageAvailable === false) {
      setError("This host is unavailable due to safety settings.");
      return;
    }
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
      setError(startError instanceof Error ? startError.message : "Could not open chat.");
    }
  }

  async function handleCall(host: Host) {
    if (!session) {
      return;
    }
    const isBlocked = Boolean(host.blocked || host.blockedByHost || host.blockedByUser);
    if (isBlocked) {
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
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
        <Ionicons name="compass-outline" size={20} color={colors.brandStart} />
      </View>
      <Text style={styles.subtitle}>
        Choose how you feel right now to discover supportive hosts.
      </Text>

      <View style={styles.topicRow}>
        {TOPICS.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.topicChip, selectedTopicId === item.id && styles.topicChipActive]}
            onPress={() => setSelectedTopicId(item.id)}
          >
            <Text style={[styles.topicText, selectedTopicId === item.id && styles.topicTextActive]}>
              {item.title}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brandStart} />
        </View>
      ) : (
        <FlatList
          data={visibleHosts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <HostCard
              host={item}
              onViewProfile={() => navigation.navigate("HostProfile", { hostId: item.id })}
              onTalkNow={() => handleTalkNow(item)}
              onCall={() => handleCall(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title="No matching hosts right now"
              subtitle="Try another topic to find someone available for a supportive chat."
            />
          }
        />
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
  topicRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  topicChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    height: 34,
    justifyContent: "center",
  },
  topicChipActive: {
    borderColor: "#F59AB2",
    backgroundColor: "#FFEAF1",
  },
  topicText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  topicTextActive: {
    color: "#BE123C",
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
  listContent: {
    paddingBottom: 16,
  },
});
