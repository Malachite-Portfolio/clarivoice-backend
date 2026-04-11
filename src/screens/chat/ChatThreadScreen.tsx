import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { MIN_CALL_START_COINS } from "../../services/callService";
import { fetchMessages, markConversationRead, sendMessage } from "../../services/chatService";
import { fetchGiftCatalog, sendGift } from "../../services/giftService";
import { fetchHostProfile } from "../../services/hostService";
import { subscribeRealtime } from "../../services/realtimeService";
import { blockHost, reportHost, unblockHost } from "../../services/safetyService";
import { useSessionStore } from "../../store/useSessionStore";
import { useWalletStore } from "../../store/useWalletStore";
import { fetchWallet } from "../../services/walletService";
import { GiftCategory, GiftItem, Host, Message } from "../../types/models";
import { RootStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "ChatThread">;

export function ChatThreadScreen({ route, navigation }: Props) {
  const { conversationId, hostId, hostName, hostAvatarUrl, hostVerified } = route.params;
  const { session, apiBaseUrl } = useSessionStore();
  const { wallet, setWallet } = useWalletStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [giftPanelOpen, setGiftPanelOpen] = useState(false);
  const [giftCategory, setGiftCategory] = useState<GiftCategory>("small");
  const [giftCatalog, setGiftCatalog] = useState<GiftItem[]>([]);
  const [giftBusyId, setGiftBusyId] = useState<string | null>(null);
  const [hostProfile, setHostProfile] = useState<Host | null>(null);

  const listRef = useRef<FlatList<Message>>(null);
  const shouldStickToBottomRef = useRef(true);
  const userId = session?.user.id ?? "";

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [messages]
  );

  const visibleGifts = useMemo(
    () => giftCatalog.filter((gift) => gift.category === giftCategory),
    [giftCatalog, giftCategory]
  );
  const blockedRelation = Boolean(
    hostProfile?.blocked || hostProfile?.blockedByHost || hostProfile?.blockedByUser
  );
  const callActionDisabled =
    blockedRelation ||
    hostProfile?.isCallAvailable === false ||
    (hostProfile ? hostProfile.availability !== "online" : false);

  function scrollToLatest(animated = true) {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated });
    }, 16);
  }

  const loadInitial = useCallback(async () => {
    if (!userId) {
      return;
    }
    setError(null);
    try {
      const [messagePage, gifts] = await Promise.all([
        fetchMessages(conversationId, userId, apiBaseUrl),
        fetchGiftCatalog(apiBaseUrl),
      ]);
      const profile = await fetchHostProfile(hostId, apiBaseUrl, userId);
      setMessages(messagePage.items);
      setNextCursor(messagePage.nextCursor);
      setGiftCatalog(gifts);
      setHostProfile(profile);
      await markConversationRead(conversationId, userId, apiBaseUrl);
      scrollToLatest(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load messages.");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, conversationId, userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadInitial();
      const unsubscribe = subscribeRealtime((event) => {
        if (event.type === "message.created" && event.payload.conversationId === conversationId) {
          setMessages((prev) => {
            if (prev.some((message) => message.id === event.payload.id)) {
              return prev;
            }
            return [...prev, event.payload];
          });
          if (shouldStickToBottomRef.current || event.payload.senderId === userId) {
            scrollToLatest();
          }
        }
        if (event.type === "host.availability.updated" && event.payload.hostId === hostId) {
          setHostProfile((prev) =>
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
          setHostProfile((prev) =>
            prev
              ? {
                  ...prev,
                  blocked,
                  blockedByUser: event.payload.blockedByUser,
                  blockedByHost: event.payload.blockedByHost,
                  isMessageAvailable: !blocked,
                  isCallAvailable: !blocked && prev.availability === "online",
                }
              : prev
          );
        }
      });
      const profilePollId = setInterval(() => {
        fetchHostProfile(hostId, apiBaseUrl, userId)
          .then((profile) => setHostProfile(profile))
          .catch(() => {
            // keep current state on transient network failure
          });
      }, 7000);
      const messagePollId = setInterval(() => {
        fetchMessages(conversationId, userId, apiBaseUrl)
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
            // websocket may still be syncing; ignore transient poll failures
          });
      }, 5000);

      return () => {
        clearInterval(profilePollId);
        clearInterval(messagePollId);
        unsubscribe();
      };
    }, [apiBaseUrl, conversationId, hostId, loadInitial, userId])
  );

  async function loadOlder() {
    if (!userId || !nextCursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const page = await fetchMessages(conversationId, userId, apiBaseUrl, nextCursor);
      setMessages((prev) => [...page.items, ...prev]);
      setNextCursor(page.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load older messages.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSendText() {
    const text = input.trim();
    if (!text || sending || !userId) {
      return;
    }
    if (blockedRelation || hostProfile?.isMessageAvailable === false) {
      setError("This host is unavailable due to safety settings.");
      return;
    }

    setSending(true);
    setError(null);
    setInput("");
    try {
      const message = await sendMessage(conversationId, userId, text, apiBaseUrl);
      setMessages((prev) => [...prev, message]);
      scrollToLatest();
    } catch (sendError) {
      setInput(text);
      setError(sendError instanceof Error ? sendError.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  async function handleSendGift(gift: GiftItem) {
    if (!userId) {
      return;
    }
    if (blockedRelation) {
      setError("This host is unavailable due to safety settings.");
      return;
    }
    setGiftBusyId(gift.id);
    setError(null);
    try {
      const giftMessage = await sendGift(apiBaseUrl, {
        userId,
        conversationId,
        giftId: gift.id,
        note: `Sent ${gift.name} with care`,
      });
      setMessages((prev) => [...prev, giftMessage]);
      setGiftPanelOpen(false);
      scrollToLatest();
    } catch (giftError) {
      setError(giftError instanceof Error ? giftError.message : "Could not send gift.");
    } finally {
      setGiftBusyId(null);
    }
  }

  function handleListScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    shouldStickToBottomRef.current = distanceFromBottom < 72;
  }

  function openSafetyMenu() {
    const blockedByUser = Boolean(hostProfile?.blockedByUser);
    Alert.alert("Safety options", "Choose an action for this conversation.", [
      {
        text: "Report host",
        onPress: async () => {
          try {
            await reportHost(userId, hostId, "Inappropriate behavior", apiBaseUrl);
            Alert.alert("Report submitted", "Thanks. Our moderation team will review it.");
          } catch (reportError) {
            Alert.alert(
              "Could not report",
              reportError instanceof Error ? reportError.message : "Try again."
            );
          }
        },
      },
      {
        text: blockedByUser ? "Unblock host" : "Block host",
        style: "destructive",
        onPress: async () => {
          try {
            if (blockedByUser) {
              await unblockHost(userId, hostId, apiBaseUrl);
            } else {
              await blockHost(userId, hostId, apiBaseUrl);
            }
            Alert.alert(
              blockedByUser ? "Host unblocked" : "Host blocked",
              blockedByUser
                ? "You can now chat and call this host again."
                : "You will no longer see this host in your feed. You can still access emergency support."
            );
            const profile = await fetchHostProfile(hostId, apiBaseUrl, userId);
            setHostProfile(profile);
            if (!blockedByUser) {
              navigation.goBack();
            }
          } catch (blockError) {
            Alert.alert(
              blockedByUser ? "Could not unblock" : "Could not block",
              blockError instanceof Error ? blockError.message : "Try again."
            );
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function handleStartCallFromChat() {
    const blocked = Boolean(hostProfile?.blocked || hostProfile?.blockedByHost || hostProfile?.blockedByUser);
    if (blocked || hostProfile?.isCallAvailable === false) {
      setError("Host is unavailable right now.");
      return;
    }
    if (hostProfile && hostProfile.availability !== "online") {
      setError("Host is offline right now.");
      return;
    }
    const latestWallet = await fetchWallet(userId, apiBaseUrl);
    setWallet(latestWallet);
    if ((latestWallet.balance ?? 0) < MIN_CALL_START_COINS) {
      setError(`You need at least ${MIN_CALL_START_COINS} coins to start a call.`);
      return;
    }

    navigation.navigate("CallSession", {
      hostId,
      hostName,
      hostAvatarUrl,
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <AppHeader
          title={hostName}
          onBack={() => navigation.goBack()}
          rightElement={
            <View style={styles.headerActions}>
              {hostVerified ? (
                <MaterialCommunityIcons
                  name="check-decagram"
                  size={18}
                  color="#0E7490"
                  style={styles.headerIcon}
                />
              ) : null}
              <Pressable onPress={() => navigation.navigate("HostProfile", { hostId })}>
                <Ionicons name="person-circle-outline" size={20} color={colors.textSecondary} />
              </Pressable>
              <Pressable onPress={handleStartCallFromChat} disabled={callActionDisabled}>
                <Ionicons
                  name="call-outline"
                  size={19}
                  color={callActionDisabled ? colors.muted : colors.brandStart}
                />
              </Pressable>
              <Pressable onPress={openSafetyMenu}>
                <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          }
        />

        <View style={styles.supportBanner}>
          <Ionicons name="heart-outline" size={14} color={colors.helpText} />
          <Text style={styles.supportText}>Use kind language. You can report or block anytime.</Text>
        </View>
        {blockedRelation ? (
          <View style={styles.blockedBanner}>
            <Ionicons name="ban-outline" size={14} color={colors.helpText} />
            <Text style={styles.blockedBannerText}>
              This host is blocked. Messaging and calls are disabled until you unblock.
            </Text>
          </View>
        ) : null}

        <View style={styles.walletBanner}>
          <Ionicons name="wallet-outline" size={13} color={colors.brandStart} />
          <Text style={styles.walletText}>Balance: {wallet?.balance ?? 0} coins</Text>
          <Pressable onPress={() => navigation.navigate("Wallet")}>
            <Text style={styles.walletLink}>Top-up</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <View style={styles.centered}>
            <Text style={styles.loadingText}>Loading conversation...</Text>
          </View>
        ) : messages.length === 0 ? (
          <EmptyState
            title="No messages yet"
            subtitle="Start with a small hello. You are in control of this conversation."
          />
        ) : (
          <FlatList
            ref={listRef}
            data={sortedMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble message={item} isMine={item.senderId === userId} />
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
          <Pressable
            style={[styles.giftButton, blockedRelation && styles.sendDisabled]}
            onPress={() => setGiftPanelOpen(true)}
            disabled={blockedRelation}
          >
            <Ionicons name="gift-outline" size={17} color={colors.brandStart} />
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            style={styles.composerInput}
            placeholder="Write a message..."
            placeholderTextColor={colors.muted}
            multiline
            maxLength={400}
            editable={!blockedRelation}
          />
          <Pressable
            style={[styles.sendButton, (!input.trim() || sending || blockedRelation) && styles.sendDisabled]}
            onPress={handleSendText}
            disabled={!input.trim() || sending || blockedRelation}
          >
            <Ionicons name="send" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={giftPanelOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setGiftPanelOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Gift</Text>
              <Pressable onPress={() => setGiftPanelOpen(false)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.categoryRow}>
              {(["small", "premium", "luxury"] as GiftCategory[]).map((category) => (
                <Pressable
                  key={category}
                  style={[
                    styles.categoryChip,
                    giftCategory === category && styles.categoryChipActive,
                  ]}
                  onPress={() => setGiftCategory(category)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      giftCategory === category && styles.categoryTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                </Pressable>
              ))}
            </View>

            <FlatList
              data={visibleGifts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.giftsList}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.giftRow}
                  onPress={() => handleSendGift(item)}
                  disabled={giftBusyId === item.id}
                >
                  <Text style={styles.giftIcon}>{item.icon}</Text>
                  <View style={styles.giftInfo}>
                    <Text style={styles.giftName}>{item.name}</Text>
                    <Text style={styles.giftCost}>{item.coinCost} coins</Text>
                  </View>
                  <Text style={styles.giftCta}>
                    {giftBusyId === item.id ? "Sending..." : "Send"}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
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
  headerIcon: {
    marginRight: -2,
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
  blockedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FFD0DE",
    backgroundColor: colors.helpBg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  blockedBannerText: {
    flex: 1,
    color: colors.helpText,
    fontSize: 12,
    lineHeight: 16,
  },
  walletBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F8CBD7",
    backgroundColor: "#FFF3F7",
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
    gap: 6,
  },
  walletText: {
    color: "#9F1239",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  walletLink: {
    color: colors.brandStart,
    fontWeight: "700",
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
    paddingBottom: 4,
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
  giftButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#F8CBD7",
    backgroundColor: "#FFF4F8",
    alignItems: "center",
    justifyContent: "center",
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "64%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 14,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  categoryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 30,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  categoryChipActive: {
    borderColor: "#F59AB2",
    backgroundColor: "#FFEAF1",
  },
  categoryText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  categoryTextActive: {
    color: "#9F1239",
  },
  giftsList: {
    paddingBottom: 14,
  },
  giftRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  giftIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  giftInfo: {
    flex: 1,
  },
  giftName: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  giftCost: {
    color: colors.textSecondary,
    marginTop: 1,
    fontSize: 12,
  },
  giftCta: {
    color: colors.brandStart,
    fontWeight: "700",
    fontSize: 12,
  },
});
