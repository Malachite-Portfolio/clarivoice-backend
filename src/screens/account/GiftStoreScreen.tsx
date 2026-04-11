import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { EmptyState } from "../../components/EmptyState";
import { PillChip } from "../../components/ui/PillChip";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { SectionCard } from "../../components/ui/SectionCard";
import { colors } from "../../config/theme";
import { fetchGiftCatalog } from "../../services/giftService";
import { fetchWallet } from "../../services/walletService";
import { useSessionStore } from "../../store/useSessionStore";
import { useWalletStore } from "../../store/useWalletStore";
import { GiftCategory, GiftItem } from "../../types/models";
import { RootStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "GiftStore">;

export function GiftStoreScreen({ navigation }: Props) {
  const { session, apiBaseUrl } = useSessionStore();
  const { wallet, setWallet } = useWalletStore();
  const [catalog, setCatalog] = useState<GiftItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<GiftCategory>("small");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user.id ?? "";

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        return;
      }
      setLoading(true);
      setError(null);
      Promise.all([fetchGiftCatalog(apiBaseUrl), fetchWallet(userId, apiBaseUrl)])
        .then(([gifts, walletData]) => {
          setCatalog(gifts);
          setWallet(walletData);
        })
        .catch((loadError) => {
          setError(loadError instanceof Error ? loadError.message : "Could not load gift store.");
        })
        .finally(() => setLoading(false));
    }, [apiBaseUrl, setWallet, userId])
  );

  const visibleItems = useMemo(
    () => catalog.filter((item) => item.category === activeCategory),
    [activeCategory, catalog]
  );

  return (
    <ScreenContainer>
      <AppHeader title="Gift Store" onBack={() => navigation.goBack()} />
      <SectionCard>
        <View style={styles.balanceRow}>
          <View>
            <Text style={styles.balanceLabel}>Wallet Balance</Text>
            <Text style={styles.balanceValue}>{wallet?.balance ?? 0} coins</Text>
          </View>
          <Pressable style={styles.topupButton} onPress={() => navigation.navigate("Wallet")}>
            <Text style={styles.topupText}>Top-up</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          Gifts can be sent from an active chat. Select a host, open chat, and tap the gift icon.
        </Text>
      </SectionCard>

      <View style={styles.categoryRow}>
        {(["small", "premium", "luxury"] as GiftCategory[]).map((category) => (
          <PillChip
            key={category}
            label={category}
            active={activeCategory === category}
            onPress={() => setActiveCategory(category)}
          />
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brandStart} />
        </View>
      ) : visibleItems.length === 0 ? (
        <EmptyState
          title="No gifts in this category"
          subtitle="This category is currently empty. Please try another one."
        />
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.left}>
                <Text style={styles.icon}>{item.icon}</Text>
                <View>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{item.category.toUpperCase()} gift</Text>
                </View>
              </View>
              <View style={styles.priceWrap}>
                <Ionicons name="wallet-outline" size={12} color="#BE123C" />
                <Text style={styles.price}>{item.coinCost}</Text>
              </View>
            </View>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  balanceLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  balanceValue: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: 21,
  },
  topupButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#F8CBD7",
    backgroundColor: "#FFF2F7",
    height: 32,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  topupText: {
    color: "#BE123C",
    fontWeight: "700",
    fontSize: 12,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  categoryRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  error: {
    color: colors.danger,
    marginBottom: 8,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingBottom: 16,
  },
  row: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  icon: {
    fontSize: 25,
  },
  name: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  priceWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#F8CBD7",
    backgroundColor: "#FFF2F7",
    paddingHorizontal: 10,
    height: 30,
    gap: 4,
  },
  price: {
    color: "#BE123C",
    fontWeight: "700",
  },
});

