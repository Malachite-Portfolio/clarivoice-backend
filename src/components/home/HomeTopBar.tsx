import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows } from "../../config/theme";

type HomeTopBarProps = {
  avatarUrl?: string | null;
  coinBalance: number;
  onPressWallet?: () => void;
  onPressTopup?: () => void;
  onPressAvatar?: () => void;
};

export function HomeTopBar({
  avatarUrl,
  coinBalance,
  onPressWallet,
  onPressTopup,
  onPressAvatar,
}: HomeTopBarProps) {
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.avatarHit}
        onPress={onPressAvatar}
        disabled={!onPressAvatar}
        accessibilityRole={onPressAvatar ? "button" : undefined}
      >
        <LinearGradient
          colors={[colors.brandStart, colors.brandEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarRing}
        >
          <View style={styles.avatarInner}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={18} color={colors.brandStart} />
              </View>
            )}
          </View>
        </LinearGradient>
      </Pressable>

      <View style={styles.walletRow}>
        <Pressable
          style={styles.coinPill}
          onPress={onPressWallet}
          disabled={!onPressWallet}
          accessibilityRole={onPressWallet ? "button" : undefined}
        >
          <Ionicons name="cash-outline" size={16} color="#F59E0B" />
          <Text style={styles.coinText}>{coinBalance}</Text>
        </Pressable>
        <Pressable
          style={styles.plusButton}
          onPress={onPressTopup}
          disabled={!onPressTopup}
          accessibilityRole={onPressTopup ? "button" : undefined}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  avatarHit: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarRing: {
    flex: 1,
    borderRadius: 21,
    padding: 2,
  },
  avatarInner: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF7FA",
  },
  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  coinPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "#FFD0DE",
    backgroundColor: "#FFF4F7",
    ...shadows.card,
  },
  coinText: {
    color: "#E64C58",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  plusButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    ...shadows.card,
  },
});
