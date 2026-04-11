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
import { fetchConversations } from "../../services/chatService";
import { subscribeRealtime } from "../../services/realtimeService";
import { useSessionStore } from "../../store/useSessionStore";
import { ConversationPreview } from "../../types/models";
import { RootStackParamList } from "../../types/navigation";
import { shortDateTime } from "../../utils/format";

export function ChatsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session, apiBaseUrl } = useSessionStore();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async (cursor?: string | null, append = false) => {
    if (!session?.user.id) {
      return;
    }
    if (!append) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await fetchConversations(session.user.id, apiBaseUrl, cursor);
      setConversations((prev) => {
        if (!append) {
          return result.items;
        }
        const deduped = result.items.filter(
          (incoming) => !prev.some((existing) => existing.id === incoming.id)
        );
        return [...prev, ...deduped];
      });
      setNextCursor(result.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load chats.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [apiBaseUrl, session?.user.id]);

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
        if (event.type === "conversation.updated") {
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
        if (event.type === "host.availability.updated") {
          setConversations((prev) =>
            prev.map((item) =>
              item.hostId === event.payload.hostId
                ? {
                    ...item,
                    hostOnline: event.payload.availability === "online",
                    counterpartOnline: event.payload.availability === "online",
                  }
                : item
            )
          );
        }
        if (event.type === "safety.block.updated" && event.payload.userId === session?.user.id) {
          if (event.payload.blockedByUser || event.payload.blockedByHost) {
            setConversations((prev) =>
              prev.filter((item) => item.hostId !== event.payload.hostId)
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
    }, [loadConversations, session?.user.id])
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <Ionicons name="chatbubbles-outline" size={20} color={colors.brandStart} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brandStart} />
        </View>
      ) : conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          subtitle="Once you start chatting with a host, your conversations will appear here."
        />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          onEndReachedThreshold={0.35}
          onEndReached={loadMore}
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
                navigation.navigate("ChatThread", {
                  conversationId: item.id,
                  hostId: item.hostId,
                  hostName: item.hostName,
                  hostAvatarUrl: item.hostAvatarUrl,
                  hostVerified: item.hostVerified,
                })
              }
            >
              <Image source={{ uri: item.hostAvatarUrl }} style={styles.avatar} />
              <View style={styles.middle}>
                <View style={styles.titleRow}>
                  <Text style={styles.name}>{item.hostName}</Text>
                  {item.hostOnline ? <View style={styles.onlineDot} /> : null}
                </View>
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: "800",
  },
  error: {
    color: colors.danger,
    marginBottom: 8,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: "#F89BB4",
  },
  middle: {
    flex: 1,
    marginHorizontal: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  preview: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 2,
  },
  time: {
    color: colors.muted,
    fontSize: 11,
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
    fontSize: 12,
    fontWeight: "700",
  },
  footerLoader: {
    paddingVertical: 10,
    alignItems: "center",
  },
});
