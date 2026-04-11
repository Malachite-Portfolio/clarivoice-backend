import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "../../components/AppHeader";
import { EmptyState } from "../../components/EmptyState";
import { MessageBubble } from "../../components/MessageBubble";
import { colors } from "../../config/theme";
import {
  blockUserByHost,
  fetchHostMessages,
  markHostConversationRead,
  reportUserByHost,
  sendHostMessage,
} from "../../services/hostService";
import { subscribeRealtime } from "../../services/realtimeService";
import { useSessionStore } from "../../store/useSessionStore";
import { Message } from "../../types/models";
import { RootStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "HostChatThread">;

export function HostChatThreadScreen({ route, navigation }: Props) {
  const { conversationId, userId, userName, userAvatarUrl } = route.params;
  const { session, apiBaseUrl } = useSessionStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<FlatList<Message>>(null);
  const shouldStickToBottomRef = useRef(true);
  const hostId = session?.user.id ?? "";

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [messages]
  );

  function scrollToLatest(animated = true) {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated });
    }, 16);
  }

  const loadInitial = useCallback(async () => {
    if (!hostId) {
      return;
    }
    setError(null);
    try {
      const page = await fetchHostMessages(conversationId, hostId, apiBaseUrl);
      setMessages(page.items);
      setNextCursor(page.nextCursor);
      await markHostConversationRead(conversationId, hostId, apiBaseUrl);
      scrollToLatest(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load messages.");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, conversationId, hostId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadInitial();
      const unsubscribe = subscribeRealtime((event) => {
        if (event.type === "message.created" && event.payload.conversationId === conversationId) {
          setMessages((prev) => {
            if (prev.some((item) => item.id === event.payload.id)) {
              return prev;
            }
            return [...prev, event.payload];
          });
          if (shouldStickToBottomRef.current || event.payload.senderId === hostId) {
            scrollToLatest();
          }
        }
      });
      const pollId = setInterval(() => {
        fetchHostMessages(conversationId, hostId, apiBaseUrl)
          .then((page) => {
            setMessages((prev) => {
              const known = new Set(prev.map((item) => item.id));
              const merged = [...prev];
              for (const incoming of page.items) {
                if (!known.has(incoming.id)) {
                  merged.push(incoming);
                }
              }
              return merged;
            });
            setNextCursor(page.nextCursor);
          })
          .catch(() => {
            // ignore transient polling failures
          });
      }, 5000);
      return () => {
        clearInterval(pollId);
        unsubscribe();
      };
    }, [conversationId, hostId, loadInitial])
  );

  function handleListScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    shouldStickToBottomRef.current = distanceFromBottom < 72;
  }

  async function loadOlder() {
    if (!hostId || !nextCursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const page = await fetchHostMessages(conversationId, hostId, apiBaseUrl, nextCursor);
      setMessages((prev) => [...page.items, ...prev]);
      setNextCursor(page.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load older messages.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSendText() {
    const text = input.trim();
    if (!text || sending || !hostId) {
      return;
    }
    setSending(true);
    setError(null);
    setInput("");
    try {
      const message = await sendHostMessage(conversationId, hostId, text, apiBaseUrl);
      setMessages((prev) => [...prev, message]);
      scrollToLatest();
    } catch (sendError) {
      setInput(text);
      setError(sendError instanceof Error ? sendError.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  function openSafetyMenu() {
    Alert.alert("Safety options", "Choose an action for this user.", [
      {
        text: "Report user",
        onPress: async () => {
          try {
            await reportUserByHost(hostId, userId, "Unsafe or abusive behavior", apiBaseUrl);
            Alert.alert("Report submitted", "Thanks. Moderation review has been queued.");
          } catch (reportError) {
            Alert.alert(
              "Could not report",
              reportError instanceof Error ? reportError.message : "Try again."
            );
          }
        },
      },
      {
        text: "Block user",
        style: "destructive",
        onPress: async () => {
          try {
            await blockUserByHost(hostId, userId, apiBaseUrl);
            Alert.alert("User blocked", "You will no longer receive this user in your queue.");
            navigation.goBack();
          } catch (blockError) {
            Alert.alert(
              "Could not block",
              blockError instanceof Error ? blockError.message : "Try again."
            );
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <AppHeader
          title={userName}
          onBack={() => navigation.goBack()}
          rightElement={
            <View style={styles.headerActions}>
              <Pressable
                onPress={() =>
                  navigation.navigate("HostCallSession", {
                    userId,
                    userName,
                    userAvatarUrl,
                  })
                }
              >
                <Ionicons name="call-outline" size={19} color={colors.brandStart} />
              </Pressable>
              <Pressable onPress={openSafetyMenu}>
                <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          }
        />

        <View style={styles.supportBanner}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.helpText} />
          <Text style={styles.supportText}>Use compassionate language and escalate concerns safely.</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <View style={styles.centered}>
            <Text style={styles.loadingText}>Loading conversation...</Text>
          </View>
        ) : messages.length === 0 ? (
          <EmptyState title="No messages yet" subtitle="Start with a supportive greeting." />
        ) : (
          <FlatList
            ref={listRef}
            data={sortedMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble message={item} isMine={item.senderId === hostId} />
            )}
            style={styles.messages}
            contentContainerStyle={styles.messageContent}
            onScroll={handleListScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              nextCursor ? (
                <Pressable onPress={loadOlder} style={styles.loadMore}>
                  {loadingMore ? (
                    <Text style={styles.loadMoreText}>Loading...</Text>
                  ) : (
                    <Text style={styles.loadMoreText}>Load older messages</Text>
                  )}
                </Pressable>
              ) : null
            }
            onContentSizeChange={() => {
              if (shouldStickToBottomRef.current) {
                scrollToLatest();
              }
            }}
          />
        )}

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            style={styles.composerInput}
            placeholder="Write a supportive response..."
            placeholderTextColor={colors.muted}
            multiline
            maxLength={400}
          />
          <Pressable
            style={[styles.sendButton, (!input.trim() || sending) && styles.sendDisabled]}
            onPress={handleSendText}
            disabled={!input.trim() || sending}
          >
            <Ionicons name="send" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardWrap: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  supportBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFD0DE",
    backgroundColor: colors.helpBg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  supportText: {
    flex: 1,
    color: colors.helpText,
    fontSize: 12,
  },
  error: {
    color: colors.danger,
    marginBottom: 4,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: colors.textSecondary,
  },
  messages: {
    flex: 1,
  },
  messageContent: {
    paddingVertical: 10,
  },
  loadMore: {
    alignItems: "center",
    paddingVertical: 6,
  },
  loadMoreText: {
    color: colors.brandStart,
    fontSize: 12,
    fontWeight: "600",
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 8 : 12,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  composerInput: {
    flex: 1,
    maxHeight: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    color: colors.textPrimary,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandStart,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: {
    opacity: 0.5,
  },
});
