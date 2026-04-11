import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../config/theme";
import { useSessionStore } from "../../store/useSessionStore";
import { useWalletStore } from "../../store/useWalletStore";
import { RootStackParamList } from "../../types/navigation";

export function AccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session, logout } = useSessionStore();
  const { wallet } = useWalletStore();

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.subtitle}>Your identity, wallet, and safety preferences.</Text>

        <View style={styles.card}>
          <Text style={styles.name}>{session?.user.displayName}</Text>
          <Text style={styles.phone}>+{session?.user.phone}</Text>
          <Text style={styles.small}>User ID: {session?.user.id}</Text>
        </View>

        <Pressable style={styles.action} onPress={() => navigation.navigate("Wallet")}>
          <MaterialCommunityIcons name="wallet-outline" size={18} color={colors.brandStart} />
          <Text style={styles.actionText}>Wallet ({wallet?.balance ?? 0} coins)</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={() => navigation.navigate("EditProfile")}>
          <MaterialCommunityIcons
            name="account-edit-outline"
            size={18}
            color={colors.brandStart}
          />
          <Text style={styles.actionText}>Edit profile</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={() => navigation.navigate("GiftStore")}>
          <MaterialCommunityIcons name="gift-outline" size={18} color={colors.brandStart} />
          <Text style={styles.actionText}>Gift store</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={() => navigation.navigate("Settings")}>
          <MaterialCommunityIcons name="cog-outline" size={18} color={colors.brandStart} />
          <Text style={styles.actionText}>Settings</Text>
        </Pressable>

        <Pressable
          style={styles.action}
          onPress={() =>
            Alert.alert(
              "Emergency resources",
              "This architecture is ready to connect geo-specific crisis resources. For immediate danger, call local emergency services now."
            )
          }
        >
          <MaterialCommunityIcons name="lifebuoy" size={18} color={colors.brandStart} />
          <Text style={styles.actionText}>Emergency resources</Text>
        </Pressable>

        <View style={styles.helpCard}>
          <Ionicons name="warning-outline" size={16} color={colors.helpText} />
          <Text style={styles.helpText}>
            If you feel in immediate danger, call local emergency services right away.
          </Text>
        </View>

        <Pressable
          style={styles.logout}
          onPress={() =>
            Alert.alert("Logout", "Are you sure you want to sign out?", [
              { text: "Cancel", style: "cancel" },
              { text: "Logout", style: "destructive", onPress: logout },
            ])
          }
        >
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 14,
    paddingBottom: 20,
  },
  title: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    marginBottom: 10,
  },
  name: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 2,
  },
  phone: {
    color: colors.textSecondary,
    marginBottom: 6,
  },
  small: {
    color: colors.muted,
    fontSize: 11,
  },
  action: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFD0DE",
    backgroundColor: "#FFF4F7",
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionText: {
    color: "#BE123C",
    fontWeight: "700",
  },
  helpCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFD0DE",
    backgroundColor: colors.helpBg,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 16,
  },
  helpText: {
    flex: 1,
    color: colors.helpText,
    fontSize: 12,
    lineHeight: 17,
  },
  logout: {
    height: 50,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  logoutText: {
    color: "#B91C1C",
    fontWeight: "700",
  },
});
