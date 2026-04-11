import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
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
import { AppButton } from "../../components/ui/AppButton";
import { AppInput } from "../../components/ui/AppInput";
import { colors } from "../../config/theme";
import {
  fetchHostGiftHistory,
  fetchHostTransactions,
  fetchHostWallet,
} from "../../services/hostService";
import { subscribeRealtime } from "../../services/realtimeService";
import {
  CreateWithdrawalPayload,
  createWithdrawalRequest,
  fetchWithdrawalDetail,
  fetchWithdrawalHistory,
} from "../../services/withdrawalService";
import { useSessionStore } from "../../store/useSessionStore";
import { Message, Wallet, WalletTransaction, WithdrawalRequest } from "../../types/models";
import { RootStackParamList } from "../../types/navigation";
import { shortDateTime } from "../../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "HostEarnings">;

type WithdrawalFormState = {
  amount: string;
  bankName: string;
  accountHolderName: string;
  ifscCode: string;
  accountNumber: string;
};

type WithdrawalFormErrors = Partial<Record<keyof WithdrawalFormState, string>>;

const QUICK_WITHDRAWAL_AMOUNTS = [5000, 10000, 20000];
const MINIMUM_WITHDRAWAL_FALLBACK = 5000;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_PATTERN = /^\d{6,34}$/;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  IN_PROGRESS: "In Progress",
  PAYMENT_DONE: "Payment Done",
  REJECTED: "Rejected",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#A16207",
  APPROVED: "#2563EB",
  IN_PROGRESS: "#7C3AED",
  PAYMENT_DONE: colors.success,
  REJECTED: colors.danger,
};

function normalizeStatus(status: WithdrawalRequest["status"]) {
  return String(status).toUpperCase();
}

function getStatusLabel(status: WithdrawalRequest["status"]) {
  const normalized = normalizeStatus(status);
  return STATUS_LABELS[normalized] ?? normalized;
}

function getStatusColor(status: WithdrawalRequest["status"]) {
  const normalized = normalizeStatus(status);
  return STATUS_COLORS[normalized] ?? colors.brandStart;
}

function getWithdrawalAmount(entry: WithdrawalRequest) {
  if (typeof entry.amount === "number" && Number.isFinite(entry.amount)) {
    return entry.amount;
  }
  if (typeof entry.amountCoins === "number" && Number.isFinite(entry.amountCoins)) {
    return entry.amountCoins;
  }
  return 0;
}

function getRequestedDate(entry: WithdrawalRequest) {
  return entry.requestedAt || entry.createdAt;
}

export function HostEarningsScreen({ navigation }: Props) {
  const { session, apiBaseUrl } = useSessionStore();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [giftHistory, setGiftHistory] = useState<Message[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [requestingAmount, setRequestingAmount] = useState<number | null>(null);
  const [withdrawalForm, setWithdrawalForm] = useState<WithdrawalFormState>({
    amount: "",
    bankName: "",
    accountHolderName: "",
    ifscCode: "",
    accountNumber: "",
  });
  const [withdrawalErrors, setWithdrawalErrors] = useState<WithdrawalFormErrors>({});
  const [minimumAmount, setMinimumAmount] = useState<number>(MINIMUM_WITHDRAWAL_FALLBACK);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [withdrawalsError, setWithdrawalsError] = useState<string | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const hostId = session?.user.id ?? "";
  const authToken = session?.token ?? "";

  const load = useCallback(async () => {
    if (!hostId || !authToken) {
      setTransactionsError("Your session has expired. Please login again.");
      setWithdrawalsError("Your session has expired. Please login again.");
      setLoading(false);
      return;
    }

    setTransactionsError(null);
    setWithdrawalsError(null);

    const [walletResult, txResult, giftsResult, withdrawalsResult] = await Promise.allSettled([
      fetchHostWallet(hostId, apiBaseUrl),
      fetchHostTransactions(hostId, apiBaseUrl),
      fetchHostGiftHistory(hostId, apiBaseUrl),
      fetchWithdrawalHistory(apiBaseUrl, authToken),
    ]);

    if (walletResult.status === "fulfilled") {
      setWallet(walletResult.value);
    }

    if (txResult.status === "fulfilled") {
      setTransactions(txResult.value.items);
      setNextCursor(txResult.value.nextCursor);
    } else {
      setTransactions([]);
      setNextCursor(null);
      setTransactionsError(
        txResult.reason instanceof Error
          ? txResult.reason.message
          : "Could not load earnings transactions."
      );
    }

    if (giftsResult.status === "fulfilled") {
      setGiftHistory(giftsResult.value.items);
    } else {
      setGiftHistory([]);
    }

    if (withdrawalsResult.status === "fulfilled") {
      setWithdrawals(withdrawalsResult.value.items);
      setSelectedWithdrawal((prev) => {
        if (!prev) {
          return prev;
        }
        const refreshed = withdrawalsResult.value.items.find((item) => item.id === prev.id);
        return refreshed ?? prev;
      });
    } else {
      setWithdrawals([]);
      setWithdrawalsError(
        withdrawalsResult.reason instanceof Error
          ? withdrawalsResult.reason.message
          : "Could not load withdrawal history."
      );
    }

    setLoading(false);
    setLoadingMore(false);
  }, [apiBaseUrl, authToken, hostId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().catch((error) => {
        setLoading(false);
        const message = error instanceof Error ? error.message : "Could not load earnings.";
        setTransactionsError(message);
        setWithdrawalsError(message);
      });
      const unsubscribe = subscribeRealtime((event) => {
        if (
          event.type === "wallet.updated" &&
          event.payload.ownerType === "host" &&
          event.payload.ownerId === hostId
        ) {
          setWallet(event.payload);
        }
        if (
          event.type === "wallet.transaction" &&
          event.payload.ownerType === "host" &&
          event.payload.ownerId === hostId
        ) {
          setTransactions((prev) =>
            prev.some((entry) => entry.id === event.payload.id)
              ? prev.map((entry) => (entry.id === event.payload.id ? event.payload : entry))
              : [event.payload, ...prev]
          );
        }
        if (
          (event.type === "call.updated" && event.payload.hostId === hostId) ||
          (event.type === "message.created" && event.payload.kind === "gift")
        ) {
          load().catch(() => {
            // Keep the current UI state if background refresh fails.
          });
        }
      });
      const pollId = setInterval(() => {
        load().catch(() => {
          // Keep the current UI state if polling refresh fails.
        });
      }, 7000);
      return () => {
        clearInterval(pollId);
        unsubscribe();
      };
    }, [hostId, load])
  );

  async function loadMore() {
    if (!hostId || !nextCursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const page = await fetchHostTransactions(hostId, apiBaseUrl, nextCursor);
      setTransactions((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (loadError) {
      setTransactionsError(
        loadError instanceof Error ? loadError.message : "Could not load more earnings."
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleRequestWithdrawal() {
    if (!hostId || !authToken) {
      setWithdrawalErrors({
        amount: "Your session has expired. Please login again.",
      });
      return;
    }

    const effectiveMinimumAmount = Math.max(minimumAmount, MINIMUM_WITHDRAWAL_FALLBACK);
    const nextErrors: WithdrawalFormErrors = {};
    const parsedAmount = Number(withdrawalForm.amount.trim());
    const bankName = withdrawalForm.bankName.trim();
    const accountHolderName = withdrawalForm.accountHolderName.trim();
    const ifscCode = withdrawalForm.ifscCode.trim().toUpperCase();
    const accountNumber = withdrawalForm.accountNumber.trim();

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      nextErrors.amount = "Enter a valid withdrawal amount.";
    } else if (parsedAmount < effectiveMinimumAmount) {
      nextErrors.amount = `Minimum withdrawal is ${effectiveMinimumAmount}.`;
    }

    if (!bankName) {
      nextErrors.bankName = "Bank name is required.";
    }

    if (!accountHolderName) {
      nextErrors.accountHolderName = "Account holder name is required.";
    }

    if (!ifscCode) {
      nextErrors.ifscCode = "IFSC code is required.";
    } else if (!IFSC_PATTERN.test(ifscCode)) {
      nextErrors.ifscCode = "Enter a valid IFSC code.";
    }

    if (!accountNumber) {
      nextErrors.accountNumber = "Account number is required.";
    } else if (!ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
      nextErrors.accountNumber = "Enter a valid account number.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setWithdrawalErrors(nextErrors);
      return;
    }

    setRequestingAmount(parsedAmount);
    setWithdrawalErrors({});
    setWithdrawalsError(null);

    try {
      const payload: CreateWithdrawalPayload = {
        amount: parsedAmount,
        bankName,
        accountHolderName,
        ifscCode,
        accountNumber,
      };
      const result = await createWithdrawalRequest(apiBaseUrl, authToken, hostId, payload);
      setWithdrawals((prev) => [result.request, ...prev.filter((item) => item.id !== result.request.id)]);
      setSelectedWithdrawal(result.request);
      if (result.wallet) {
        setWallet(result.wallet);
      }
      if (result.minimumAmount !== null && Number.isFinite(result.minimumAmount)) {
        setMinimumAmount(Math.max(result.minimumAmount, MINIMUM_WITHDRAWAL_FALLBACK));
      }
      setWithdrawalForm({
        amount: "",
        bankName: "",
        accountHolderName: "",
        ifscCode: "",
        accountNumber: "",
      });

      const refreshedHistory = await fetchWithdrawalHistory(apiBaseUrl, authToken);
      setWithdrawals(refreshedHistory.items);

      Alert.alert(
        "Withdrawal requested",
        `${parsedAmount} request submitted successfully. You can track status below.`
      );
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Could not request withdrawal.";
      setWithdrawalsError(message);
      Alert.alert("Request failed", message);
    } finally {
      setRequestingAmount(null);
    }
  }

  async function handleSelectWithdrawal(entry: WithdrawalRequest) {
    if (!authToken) {
      setDetailError("Your session has expired. Please login again.");
      return;
    }

    setSelectedWithdrawal(entry);
    setDetailError(null);
    setDetailLoading(true);

    try {
      const detail = await fetchWithdrawalDetail(apiBaseUrl, authToken, entry.id);
      setSelectedWithdrawal(detail);
      setWithdrawals((prev) => prev.map((item) => (item.id === detail.id ? detail : item)));
    } catch (detailLoadError) {
      setDetailError(
        detailLoadError instanceof Error
          ? detailLoadError.message
          : "Could not load withdrawal details."
      );
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>
        <AppHeader title="Host Earnings" onBack={() => navigation.goBack()} />

        <LinearGradient
          colors={[colors.brandStart, colors.brandEnd]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceTitle}>Total Earnings</Text>
          <Text style={styles.balanceValue}>{wallet?.balance ?? 0}</Text>
          <Text style={styles.balanceHint}>Gifts and call income are reflected here.</Text>
        </LinearGradient>

        <Text style={styles.sectionTitle}>Recent Gifts</Text>
        {giftHistory.length === 0 ? (
          <EmptyState title="No gifts received yet" subtitle="Received user gifts will appear here." />
        ) : (
          <View style={styles.giftList}>
            {giftHistory.slice(0, 4).map((message) => (
              <View key={message.id} style={styles.giftRow}>
                <Text style={styles.giftName}>
                  {message.gift?.icon} {message.gift?.name ?? "Gift"}
                </Text>
                <Text style={styles.giftTime}>{shortDateTime(message.createdAt)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Withdrawals</Text>
        <View style={styles.withdrawalForm}>
          <AppInput
            label="Withdrawal amount"
            keyboardType="numeric"
            value={withdrawalForm.amount}
            placeholder="Enter amount"
            onChangeText={(value) => {
              setWithdrawalForm((prev) => ({
                ...prev,
                amount: value.replace(/[^\d.]/g, ""),
              }));
              if (withdrawalErrors.amount) {
                setWithdrawalErrors((prev) => ({ ...prev, amount: undefined }));
              }
            }}
            error={withdrawalErrors.amount ?? null}
          />

          <View style={styles.quickAmountRow}>
            {QUICK_WITHDRAWAL_AMOUNTS.map((amount) => (
              <Pressable
                key={amount}
                style={styles.quickAmountChip}
                onPress={() => {
                  setWithdrawalForm((prev) => ({ ...prev, amount: String(amount) }));
                  setWithdrawalErrors((prev) => ({ ...prev, amount: undefined }));
                }}
              >
                <Text style={styles.quickAmountText}>{amount}</Text>
              </Pressable>
            ))}
          </View>

          <AppInput
            label="Bank Name"
            value={withdrawalForm.bankName}
            placeholder="Enter bank name"
            onChangeText={(value) => {
              setWithdrawalForm((prev) => ({ ...prev, bankName: value }));
              if (withdrawalErrors.bankName) {
                setWithdrawalErrors((prev) => ({ ...prev, bankName: undefined }));
              }
            }}
            error={withdrawalErrors.bankName ?? null}
          />

          <AppInput
            label="Account Holder Name"
            value={withdrawalForm.accountHolderName}
            placeholder="Enter account holder name"
            onChangeText={(value) => {
              setWithdrawalForm((prev) => ({ ...prev, accountHolderName: value }));
              if (withdrawalErrors.accountHolderName) {
                setWithdrawalErrors((prev) => ({ ...prev, accountHolderName: undefined }));
              }
            }}
            error={withdrawalErrors.accountHolderName ?? null}
          />

          <AppInput
            label="IFSC Code"
            autoCapitalize="characters"
            value={withdrawalForm.ifscCode}
            placeholder="Enter IFSC code"
            onChangeText={(value) => {
              setWithdrawalForm((prev) => ({
                ...prev,
                ifscCode: value.toUpperCase(),
              }));
              if (withdrawalErrors.ifscCode) {
                setWithdrawalErrors((prev) => ({ ...prev, ifscCode: undefined }));
              }
            }}
            error={withdrawalErrors.ifscCode ?? null}
          />

          <AppInput
            label="Account Number"
            keyboardType="numeric"
            value={withdrawalForm.accountNumber}
            placeholder="Enter account number"
            onChangeText={(value) => {
              setWithdrawalForm((prev) => ({
                ...prev,
                accountNumber: value.replace(/[^\d]/g, ""),
              }));
              if (withdrawalErrors.accountNumber) {
                setWithdrawalErrors((prev) => ({ ...prev, accountNumber: undefined }));
              }
            }}
            error={withdrawalErrors.accountNumber ?? null}
          />

          <AppButton
            label="Request withdrawal"
            onPress={handleRequestWithdrawal}
            loading={requestingAmount !== null}
            disabled={requestingAmount !== null}
          />

          <Text style={styles.minimumText}>Minimum withdrawal: {minimumAmount}</Text>
        </View>

        {loading ? (
          <View style={styles.loaderInline}>
            <ActivityIndicator color={colors.brandStart} />
          </View>
        ) : withdrawalsError ? (
          <Text style={styles.error}>{withdrawalsError}</Text>
        ) : withdrawals.length === 0 ? (
          <EmptyState
            title="No withdrawal requests yet"
            subtitle="Create your first withdrawal request to start tracking status."
          />
        ) : (
          <View style={styles.withdrawalList}>
            {withdrawals.slice(0, 6).map((entry) => (
              <Pressable
                key={entry.id}
                style={styles.withdrawalRow}
                onPress={() => handleSelectWithdrawal(entry)}
              >
                <View style={styles.withdrawalRowTop}>
                  <View>
                    <Text style={styles.withdrawalAmount}>{getWithdrawalAmount(entry)}</Text>
                    <Text style={styles.withdrawalTime}>{shortDateTime(getRequestedDate(entry))}</Text>
                  </View>
                  <Text style={[styles.withdrawalStatus, { color: getStatusColor(entry.status) }]}>
                    {getStatusLabel(entry.status)}
                  </Text>
                </View>
                <Text style={styles.withdrawalMetaText}>
                  Note: {entry.adminNote?.trim() ? entry.adminNote : "No admin note yet"}
                </Text>
                <Text style={styles.withdrawalMetaText}>
                  Ref: {entry.transactionReference?.trim() ? entry.transactionReference : "Pending"}
                </Text>
                <Text style={styles.withdrawalHint}>Tap to refresh details</Text>
              </Pressable>
            ))}
          </View>
        )}

        {selectedWithdrawal ? (
          <View style={styles.detailCard}>
            <View style={styles.detailHeaderRow}>
              <Text style={styles.detailTitle}>Selected request</Text>
              {detailLoading ? <ActivityIndicator size="small" color={colors.brandStart} /> : null}
            </View>

            <Text style={styles.detailLine}>Amount: {getWithdrawalAmount(selectedWithdrawal)}</Text>
            <Text style={styles.detailLine}>
              Status: {getStatusLabel(selectedWithdrawal.status)}
            </Text>
            <Text style={styles.detailLine}>
              Requested: {shortDateTime(getRequestedDate(selectedWithdrawal))}
            </Text>
            <Text style={styles.detailLine}>
              Admin note: {selectedWithdrawal.adminNote?.trim() || "No note available"}
            </Text>
            <Text style={styles.detailLine}>
              Transaction ref: {selectedWithdrawal.transactionReference?.trim() || "Not added yet"}
            </Text>
            {detailError ? <Text style={styles.errorInline}>{detailError}</Text> : null}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Earnings Transactions</Text>
        {transactionsError ? <Text style={styles.error}>{transactionsError}</Text> : null}
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.brandStart} />
          </View>
        ) : transactions.length === 0 ? (
          <EmptyState title="No earnings yet" subtitle="Earning entries will appear after interactions." />
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.txList}
            showsVerticalScrollIndicator={false}
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
  giftList: {
    marginBottom: 12,
  },
  withdrawalForm: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10,
    marginBottom: 8,
  },
  quickAmountRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  quickAmountChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  quickAmountText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  minimumText: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 8,
  },
  withdrawalList: {
    marginBottom: 10,
  },
  withdrawalRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10,
    marginBottom: 8,
  },
  withdrawalRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  withdrawalAmount: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  withdrawalTime: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  withdrawalStatus: {
    fontWeight: "700",
    fontSize: 12,
  },
  withdrawalMetaText: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  withdrawalHint: {
    color: colors.brandStart,
    fontSize: 11,
    marginTop: 5,
    fontWeight: "600",
  },
  detailCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 10,
    marginBottom: 10,
  },
  detailHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  detailTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  detailLine: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  giftRow: {
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
  giftName: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  giftTime: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  txList: {
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
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loaderInline: {
    paddingVertical: 10,
    alignItems: "center",
  },
  footerLoader: {
    paddingVertical: 10,
    alignItems: "center",
  },
  error: {
    color: colors.danger,
    marginBottom: 6,
  },
  errorInline: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 6,
  },
});
