import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { EmptyState } from "../../components/EmptyState";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { colors } from "../../config/theme";
import { fetchHostCalls, fetchHostConversations, fetchHostGiftHistory } from "../../services/hostService";
import { subscribeRealtime } from "../../services/realtimeService";
import { useSessionStore } from "../../store/useSessionStore";
import { CallRecord, ConversationPreview, Message } from "../../types/models";
import { RootStackParamList } from "../../types/navigation";
import { shortDateTime } from "../../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "HostActivity">;

type ActivityItem = {
  id: string;
  type: "chat" | "call" | "gift";
  title: string;
  subtitle: string;
  at: string;
};

export function HostActivityScreen({ navigation }: Props) {
  const { session, apiBaseUrl } = useSessionStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chats, setChats] = useState<ConversationPreview[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [gifts, setGifts] = useState<Message[]>([]);

  const hostId = session?.user.id ?? "";

  useFocusEffect(
    useCallback(() => {
      if (!hostId) {
        return;
      }
      setLoading(true);
      setError(null);

      Promise.all([
        fetchHostConversations(hostId, apiBaseUrl, undefined, 30),
        fetchHostCalls(hostId, apiBaseUrl, undefined, 30),
        fetchHostGiftHistory(hostId, apiBaseUrl, undefined, 30),
      ])
        .then(([chatRes, callRes, giftRes]) => {
          setChats(chatRes.items);
          setCalls(callRes.items);
          setGifts(giftRes.items);
        })
        .catch((loadError) => {
          setError(loadError instanceof Error ? loadError.message : "Could not load host activity.");
        })
        .finally(() => setLoading(false));
      const unsubscribe = subscribeRealtime((event) => {
        if (
          (event.type === "conversation.updated" && event.payload.roleView === "host") ||
          (event.type === "call.updated" && event.payload.hostId === hostId) ||
          (event.type === "message.created" && event.payload.kind === "gift")
        ) {
          Promise.all([
            fetchHostConversations(hostId, apiBaseUrl, undefined, 30),
            fetchHostCalls(hostId, apiBaseUrl, undefined, 30),
            fetchHostGiftHistory(hostId, apiBaseUrl, undefined, 30),
          ])
            .then(([chatRes, callRes, giftRes]) => {
              setChats(chatRes.items);
              setCalls(callRes.items);
              setGifts(giftRes.items);
            })
            .catch(() => {
              // keep last visible data on transient realtime refresh failures
            });
        }
      });
      const pollId = setInterval(() => {
        Promise.all([
          fetchHostConversations(hostId, apiBaseUrl, undefined, 30),
          fetchHostCalls(hostId, apiBaseUrl, undefined, 30),
          fetchHostGiftHistory(hostId, apiBaseUrl, undefined, 30),
        ])
          .then(([chatRes, callRes, giftRes]) => {
            setChats(chatRes.items);
            setCalls(callRes.items);
            setGifts(giftRes.items);
          })
          .catch(() => {
            // ignore transient polling failures
          });
      }, 7000);

      return () => {
        clearInterval(pollId);
        unsubscribe();
      };
    }, [apiBaseUrl, hostId])
  );

  const activity = useMemo<ActivityItem[]>(() => {
    const chatItems = chats.map((item) => ({
      id: `chat-${item.id}`,
      type: "chat" as const,
      title: `Chat with ${item.userName}`,
      subtitle: item.lastMessage,
      at: item.lastMessageAt,
    }));

    const callItems = calls.map((item) => ({
      id: `call-${item.id}`,
      type: "call" as const,
      title: `Call with ${item.userName}`,
      subtitle: item.state.toUpperCase(),
      at: item.startedAt,
    }));

    const giftItems = gifts
      .filter((message) => message.kind === "gift" && message.gift)
      .map((message) => ({
        id: `gift-${message.id}`,
        type: "gift" as const,
        title: `${message.gift?.icon} ${message.gift?.name ?? "Gift"} received`,
        subtitle: `${message.gift?.coinCost ?? 0} coins`,
        at: message.createdAt,
      }));

    return [...chatItems, ...callItems, ...giftItems].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );
  }, [calls, chats, gifts]);

  return (
    <ScreenContainer>
      <AppHeader title="Host Activity" onBack={() => navigation.goBack()} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brandStart} />
        </View>
      ) : activity.length === 0 ? (
        <EmptyState title="No activity yet" subtitle="Chat, call, and gifts history will appear here." />
      ) : (
        <FlatList
          data={activity}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.typePill}>
                <Text style={styles.typeText}>{item.type}</Text>
              </View>
              <View style={styles.meta}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.time}>{shortDateTime(item.at)}</Text>
            </View>
          )}
        />
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
  list: {
    paddingBottom: 18,
  },
  row: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  typePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#F8CAD8",
    backgroundColor: "#FFF4F8",
    paddingHorizontal: 8,
    height: 24,
    justifyContent: "center",
    marginRight: 8,
  },
  typeText: {
    color: "#BE123C",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  meta: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: 1,
    fontSize: 12,
  },
  time: {
    color: colors.muted,
    fontSize: 11,
  },
  error: {
    color: colors.danger,
    marginBottom: 8,
  },
});
