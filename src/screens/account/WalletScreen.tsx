import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "../../components/AppHeader";
import { EmptyState } from "../../components/EmptyState";
import { colors } from "../../config/theme";
import {
  confirmTopup,
  createTopupIntent,
  fetchWallet,
  fetchWalletTransactions,
} from "../../services/walletService";
import { useSessionStore } from "../../store/useSessionStore";
import { useWalletStore } from "../../store/useWalletStore";
import { RootStackParamList } from "../../types/navigation";
import { shortDateTime } from "../../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "Wallet">;

const TOPUP_OPTIONS = [
  { amountInr: 49, coins: 100 },
  { amountInr: 99, coins: 220 },
  { amountInr: 199, coins: 500 },
  { amountInr: 499, coins: 1400 },
];

export function WalletScreen({ navigation }: Props) {
  const { session, apiBaseUrl } = useSessionStore();
  const { wallet, transactions, nextCursor, setWallet, setTransactionsPage, setError, error } =
    useWalletStore();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [topupLoading, setTopupLoading] = useState<number | null>(null);

  const userId = session?.user.id ?? "";

  const loadWallet = useCallback(async () => {
    if (!userId) {
      return;
    }
    setError(null);
    try {
      const [walletData, txPage] = await Promise.all([
        fetchWallet(userId, apiBaseUrl),
        fetchWalletTransactions(userId, apiBaseUrl),
      ]);
      setWallet(walletData);
      setTransactionsPage(txPage.items, txPage.nextCursor, false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load wallet data.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [apiBaseUrl, setError, setTransactionsPage, setWallet, userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadWallet();
      const pollId = setInterval(() => {
        loadWallet();
      }, 7000);
      return () => {
        clearInterval(pollId);
      };
    }, [loadWallet])
  );

  async function loadMoreTransactions() {
    if (!userId || !nextCursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const page = await fetchWalletTransactions(userId, apiBaseUrl, nextCursor);
      setTransactionsPage(page.items, page.nextCursor, true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load more history.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleTopup(amountInr: number, coins: number) {
    if (!userId) {
      return;
    }
    setTopupLoading(amountInr);
    try {
      const intent = await createTopupIntent(userId, apiBaseUrl, amountInr, coins);
      const simulatedSuccess = Math.random() > 0.12;
      const result = await confirmTopup(userId, intent.intentId, apiBaseUrl, simulatedSuccess);
      if (result.status === "success") {
        Alert.alert("Top-up successful", `${coins} coins added to your wallet.`);
      } else {
        Alert.alert("Top-up failed", "Payment simulation failed. Please retry.");
      }
      await loadWallet();
    } catch (topupError) {
      Alert.alert(
        "Top-up error",
        topupError instanceof Error ? topupError.message : "Could not process top-up."
      );
    } finally {
      setTopupLoading(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>
        <AppHeader title="Wallet" onBack={() => navigation.goBack()} />

        <LinearGradient
          colors={[colors.brandStart, colors.brandEnd]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceTitle}>Available Coins</Text>
          <Text style={styles.balanceValue}>{wallet?.balance ?? 0}</Text>
          <Text style={styles.balanceHint}>Use coins for gifts, calls, and premium interactions.</Text>
        </LinearGradient>

        <Pressable style={styles.giftStoreCard} onPress={() => navigation.navigate("GiftStore")}>
          <Text style={styles.giftStoreTitle}>Browse Gift Store</Text>
          <Text style={styles.giftStoreText}>
            Explore small, premium, and luxury gifts before sending from chat.
          </Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Top-up</Text>
        <View style={styles.topupGrid}>
          {TOPUP_OPTIONS.map((option) => {
            const busy = topupLoading === option.amountInr;
            return (
              <Pressable
                key={option.amountInr}
                style={styles.topupItem}
                onPress={() => handleTopup(option.amountInr, option.coins)}
                disabled={busy}
              >
                <Text style={styles.topupCoins}>{option.coins} coins</Text>
                <Text style={styles.topupAmount}>INR {option.amountInr}</Text>
                {busy ? (
                  <ActivityIndicator color={colors.brandStart} />
                ) : (
                  <Text style={styles.topupCta}>Top-up</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Transaction History</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.brandStart} />
          </View>
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            subtitle="Your top-ups, gift spends, and refunds will appear here."
          />
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            style={styles.transactionsList}
            contentContainerStyle={styles.transactionsContent}
            onEndReachedThreshold={0.3}
            onEndReached={loadMoreTransactions}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator color={colors.brandStart} />
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <View style={styles.txRow}>
                <View style={styles.txMeta}>
                  <Text style={styles.txDescription}>{item.description}</Text>
                  <Text style={styles.txDate}>{shortDateTime(item.createdAt)}</Text>
                </View>
                <View style={styles.txAmountWrap}>
                  <Text
                    style={[
                      styles.txAmount,
                      item.amount >= 0 ? styles.txPositive : styles.txNegative,
                    ]}
                  >
                    {item.amount >= 0 ? "+" : ""}
                    {item.amount}
                  </Text>
                  <Text style={styles.txBalance}>Bal: {item.balanceAfter}</Text>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  root: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  balanceCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  balanceTitle: {
    color: "#FFFFFF",
    opacity: 0.9,
    fontSize: 12,
  },
  balanceValue: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "800",
    marginVertical: 2,
  },
  balanceHint: {
    color: "#FFF1F2",
    fontSize: 12,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  giftStoreCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFD0DE",
    backgroundColor: "#FFF4F7",
    padding: 12,
    marginBottom: 12,
  },
  giftStoreTitle: {
    color: "#BE123C",
    fontWeight: "800",
    marginBottom: 2,
  },
  giftStoreText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  topupGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  topupItem: {
    width: "48%",
    minWidth: 132,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  topupCoins: {
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: 2,
  },
  topupAmount: {
    color: colors.textSecondary,
    marginBottom: 6,
  },
  topupCta: {
    color: colors.brandStart,
    fontWeight: "700",
    fontSize: 12,
  },
  error: {
    color: colors.danger,
    marginBottom: 6,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  transactionsList: {
    flex: 1,
  },
  transactionsContent: {
    paddingBottom: 16,
  },
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 8,
  },
  txMeta: {
    flex: 1,
    marginRight: 10,
  },
  txDescription: {
    color: colors.textPrimary,
    fontWeight: "600",
    marginBottom: 2,
  },
  txDate: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  txAmountWrap: {
    alignItems: "flex-end",
  },
  txAmount: {
    fontWeight: "800",
  },
  txPositive: {
    color: colors.success,
  },
  txNegative: {
    color: "#BE123C",
  },
  txBalance: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  footerLoader: {
    paddingVertical: 10,
    alignItems: "center",
  },
});
