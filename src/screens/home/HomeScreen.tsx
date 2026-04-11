import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../components/EmptyState";
import { HostCard } from "../../components/HostCard";
import { HomeTopBar } from "../../components/home/HomeTopBar";
import { colors, shadows } from "../../config/theme";
import { fetchConversations, fetchHosts, startConversation } from "../../services/chatService";
import { subscribeRealtime } from "../../services/realtimeService";
import { fetchWallet } from "../../services/walletService";
import { useSessionStore } from "../../store/useSessionStore";
import { useWalletStore } from "../../store/useWalletStore";
import { Host } from "../../types/models";
import { RootStackParamList } from "../../types/navigation";

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session, apiBaseUrl } = useSessionStore();
  const { wallet, setWallet } = useWalletStore();
  const [hosts, setHosts] = useState<Host[]>([]);
  const [followingHostIds, setFollowingHostIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "Following" | "Trending" | "Nearby">("All");
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user.id ?? "";

  const loadHosts = useCallback(async () => {
    if (!userId) {
      return;
    }
    setError(null);
    try {
      const [hostsData, walletData, conversationsPage] = await Promise.all([
        fetchHosts(userId, apiBaseUrl),
        fetchWallet(userId, apiBaseUrl),
        fetchConversations(userId, apiBaseUrl, undefined, 50).catch(() => ({
          items: [],
          nextCursor: null,
        })),
      ]);
      setHosts(hostsData);
      setWallet(walletData);
      setFollowingHostIds(conversationsPage.items.map((item) => item.hostId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load hosts.");
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  const visibleHosts = useMemo(() => {
    const queryLower = query.trim().toLowerCase();
    const filtered = hosts.filter((host) => {
      const matchesQuery =
        queryLower.length === 0 ||
        host.name.toLowerCase().includes(queryLower) ||
        host.languages.join(" ").toLowerCase().includes(queryLower);

      const matchesFilter =
        filter === "All"
          ? true
          : filter === "Following"
            ? followingHostIds.includes(host.id)
            : filter === "Nearby"
              ? host.availability === "online"
              : true;

      return matchesQuery && matchesFilter;
    });

    if (filter !== "Trending") {
      return filtered;
    }

    const score = (host: Host) =>
      (host.availability === "online" ? 4 : host.availability === "busy" ? 2 : 0) +
      (host.verified ? 1 : 0);

    return [...filtered].sort((left, right) => score(right) - score(left));
  }, [filter, followingHostIds, hosts, query]);

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

  const header = (
    <View style={styles.headerWrap}>
      <HomeTopBar
        avatarUrl={session?.user.avatarUrl ?? null}
        coinBalance={wallet?.balance ?? 0}
        onPressWallet={() => navigation.navigate("Wallet")}
        onPressTopup={() => navigation.navigate("Wallet")}
      />

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search country name or code"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={styles.filterRow}>
        {(["All", "Following", "Trending", "Nearby"] as const).map((item) => (
          <Pressable
            key={item}
            style={[styles.filterChip, filter === item && styles.filterChipActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
              {item}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        {header}
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brandStart} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <FlatList
        data={visibleHosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HostCard
            host={item}
            onViewProfile={() => navigation.navigate("HostProfile", { hostId: item.id })}
            onTalkNow={() => handleTalkNow(item)}
            onCall={() => {}}
            showCallAction={false}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            title="No hosts found"
            subtitle="Try another filter or search. Blocked hosts are hidden for your safety."
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadHosts();
            }}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  headerWrap: {
    marginBottom: 6,
  },
  searchWrap: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 12,
    ...shadows.card,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: colors.textPrimary,
    fontSize: 16,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    height: 36,
    justifyContent: "center",
  },
  filterChipActive: {
    borderColor: "#E64C58",
    backgroundColor: "#E64C58",
  },
  filterText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingBottom: 16,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  error: {
    color: colors.danger,
    marginBottom: 10,
  },
});
