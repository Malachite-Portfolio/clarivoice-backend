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
import { fetchHostCalls } from "../../services/hostService";
import { subscribeRealtime } from "../../services/realtimeService";
import { useSessionStore } from "../../store/useSessionStore";
import { CallRecord } from "../../types/models";
import { RootStackParamList } from "../../types/navigation";
import { callDuration, shortDateTime } from "../../utils/format";

export function HostCallsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session, apiBaseUrl } = useSessionStore();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hostId = session?.user.id ?? "";

  const loadCalls = useCallback(
    async (cursor?: string | null, append = false) => {
      if (!hostId) {
        return;
      }
      if (!append) {
        setLoading(true);
      }
      setError(null);
      try {
        const result = await fetchHostCalls(hostId, apiBaseUrl, cursor);
        setCalls((prev) => {
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
        setError(loadError instanceof Error ? loadError.message : "Could not load host calls.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [apiBaseUrl, hostId]
  );

  const loadMore = useCallback(() => {
    if (!nextCursor || loading || loadingMore) {
      return;
    }
    setLoadingMore(true);
    loadCalls(nextCursor, true);
  }, [loadCalls, loading, loadingMore, nextCursor]);

  useFocusEffect(
    useCallback(() => {
      loadCalls();
      const unsubscribe = subscribeRealtime((event) => {
        if (event.type === "call.updated" && event.payload.hostId === hostId) {
          setCalls((prev) => {
            const index = prev.findIndex((call) => call.id === event.payload.id);
            if (index === -1) {
              return [event.payload, ...prev];
            }
            const next = [...prev];
            next[index] = event.payload;
            return next.sort(
              (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
            );
          });
        }
      });
      const pollId = setInterval(() => {
        if (!hostId) {
          return;
        }
        fetchHostCalls(hostId, apiBaseUrl, undefined)
          .then((result) => {
            setCalls((prev) => {
              const indexById = new Map(prev.map((item, index) => [item.id, index]));
              const next = [...prev];
              for (const incoming of result.items) {
                const index = indexById.get(incoming.id);
                if (index === undefined) {
                  next.push(incoming);
                } else {
                  next[index] = incoming;
                }
              }
              return next.sort(
                (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
              );
            });
            setNextCursor(result.nextCursor);
          })
          .catch(() => {
            // ignore transient polling errors
          });
      }, 7000);
      return () => {
        clearInterval(pollId);
        unsubscribe();
      };
    }, [hostId, loadCalls])
  );

  function stateColor(state: CallRecord["state"]) {
    if (state === "connected") return "#16A34A";
    if (state === "missed" || state === "failed" || state === "declined") return "#DC2626";
    if (state === "ringing" || state === "calling" || state === "accepted" || state === "connecting") return "#C2410C";
    return colors.textSecondary;
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Host Calls</Text>
        <Ionicons name="call-outline" size={20} color={colors.brandStart} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brandStart} />
        </View>
      ) : calls.length === 0 ? (
        <EmptyState
          title="No call history"
          subtitle="Calls with users will appear here when they are started."
        />
      ) : (
        <FlatList
          data={calls}
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
                navigation.navigate("HostCallSession", {
                  callId: item.id,
                  userId: item.userId,
                  userName: item.userName,
                  userAvatarUrl: item.userAvatarUrl,
                })
              }
            >
              <Image source={{ uri: item.userAvatarUrl }} style={styles.avatar} />
              <View style={styles.middle}>
                <Text style={styles.name}>{item.userName}</Text>
                <Text style={[styles.state, { color: stateColor(item.state) }]}>
                  {item.state.toUpperCase()}
                </Text>
                <Text style={styles.time}>{shortDateTime(item.startedAt)}</Text>
              </View>
              <Text style={styles.duration}>{callDuration(item.durationSec)}</Text>
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
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: 18,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
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
  state: {
    fontSize: 12,
    marginTop: 1,
    fontWeight: "700",
  },
  time: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  duration: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  footerLoader: {
    paddingVertical: 10,
    alignItems: "center",
  },
});
