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
import { EmptyState } from "../../components/EmptyState";
import { colors } from "../../config/theme";
import { fetchHostConversations } from "../../services/hostService";
import { subscribeRealtime } from "../../services/realtimeService";
import { useSessionStore } from "../../store/useSessionStore";
import { ConversationPreview } from "../../types/models";
import { RootStackParamList } from "../../types/navigation";
import { shortDateTime } from "../../utils/format";

export function HostChatsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session, apiBaseUrl } = useSessionStore();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hostId = session?.user.id ?? "";

  const loadConversations = useCallback(
    async (cursor?: string | null, append = false) => {
      if (!hostId) {
        return;
      }
      if (!append) {
        setLoading(true);
      }
      setError(null);
      try {
        const response = await fetchHostConversations(hostId, apiBaseUrl, cursor);
        setConversations((prev) => {
          if (!append) {
            return response.items;
          }
          const deduped = response.items.filter(
            (incoming) => !prev.some((existing) => existing.id === incoming.id)
          );
          return [...prev, ...deduped];
        });
        setNextCursor(response.nextCursor);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load host chats.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [apiBaseUrl, hostId]
  );

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore || loading) {
      return;
    }
    setLoadingMore(true);
    loadConversations(nextCursor, true);
  }, [loadConversations, loading, loadingMore, nextCursor]);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
      const unsubscribe = subscribeRealtime((event) => {
        if (event.type === "conversation.updated" && event.payload.roleView === "host") {
          setConversations((prev) => {
            const index = prev.findIndex((item) => item.id === event.payload.id);
            if (index === -1) {
              return [event.payload, ...prev];
            }
            const next = [...prev];
            next[index] = event.payload;
            return next.sort(
              (a, b) =>
                new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
            );
          });
        }
        if (event.type === "safety.block.updated" && event.payload.hostId === hostId) {
          if (event.payload.blockedByUser || event.payload.blockedByHost) {
            setConversations((prev) =>
              prev.filter((item) => item.userId !== event.payload.userId)
            );
          } else {
            loadConversations();
          }
        }
      });
      const pollId = setInterval(() => {
        loadConversations();
      }, 7000);
      return () => {
        clearInterval(pollId);
        unsubscribe();
      };
    }, [hostId, loadConversations])
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Incoming Chats</Text>
        <Ionicons name="chatbubbles-outline" size={20} color={colors.brandStart} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brandStart} />
        </View>
      ) : conversations.length === 0 ? (
        <EmptyState
          title="No user chats yet"
          subtitle="Conversations from users will appear here once they message you."
        />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.brandStart} />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() =>
                navigation.navigate("HostChatThread", {
                  conversationId: item.id,
                  userId: item.userId,
                  userName: item.userName,
                  userAvatarUrl: item.userAvatarUrl,
                })
              }
            >
              <Image source={{ uri: item.userAvatarUrl }} style={styles.avatar} />
              <View style={styles.middle}>
                <Text style={styles.name}>{item.userName}</Text>
                <Text numberOfLines={1} style={styles.preview}>
                  {item.lastMessage}
                </Text>
                <Text style={styles.time}>{shortDateTime(item.lastMessageAt)}</Text>
              </View>
              {item.unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          )}
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
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  error: {
    color: colors.danger,
    marginBottom: 8,
  },
  listContent: {
    paddingBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  middle: {
    flex: 1,
    marginHorizontal: 10,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  preview: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 1,
  },
  time: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brandStart,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  footerLoader: {
    paddingVertical: 10,
    alignItems: "center",
  },
});
