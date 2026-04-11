import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../config/theme";
import { fetchHostProfile } from "../../services/hostService";
import { useSessionStore } from "../../store/useSessionStore";
import { Host } from "../../types/models";
import { RootStackParamList } from "../../types/navigation";

export function HostAccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session, apiBaseUrl, logout } = useSessionStore();
  const [profile, setProfile] = useState<Host | null>(null);

  const hostId = session?.user.id ?? "";

  useFocusEffect(
    useCallback(() => {
      if (!hostId) {
        return;
      }
      fetchHostProfile(hostId, apiBaseUrl)
        .then((result) => setProfile(result))
        .catch(() => {
          // Keep resilient fallback profile.
        });
    }, [apiBaseUrl, hostId])
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Host Account</Text>
        <Text style={styles.subtitle}>Profile, safety, and host controls.</Text>

        <View style={styles.card}>
          <Text style={styles.name}>{profile?.name ?? session?.user.displayName}</Text>
          <Text style={styles.phone}>+{session?.user.phone}</Text>
          <Text style={styles.small}>Host ID: {session?.user.id}</Text>
          <Text style={styles.small}>Availability: {profile?.availability ?? "offline"}</Text>
        </View>

        <Pressable style={styles.action} onPress={() => navigation.navigate("HostEarnings")}>
          <MaterialCommunityIcons name="wallet-outline" size={18} color={colors.brandStart} />
          <Text style={styles.actionText}>Earnings & gift history</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={() => navigation.navigate("HostProfileSelf")}>
          <MaterialCommunityIcons name="account-outline" size={18} color={colors.brandStart} />
          <Text style={styles.actionText}>Public host profile</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={() => navigation.navigate("HostSettings")}>
          <MaterialCommunityIcons name="cog-outline" size={18} color={colors.brandStart} />
          <Text style={styles.actionText}>Host settings</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={() => navigation.navigate("HostActivity")}>
          <MaterialCommunityIcons name="history" size={18} color={colors.brandStart} />
          <Text style={styles.actionText}>Activity history</Text>
        </Pressable>

        <Pressable
          style={styles.action}
          onPress={() =>
            Alert.alert(
              "Emergency resources",
              "Host flow is prepared for integrating geo-specific crisis and moderation escalation."
            )
          }
        >
          <MaterialCommunityIcons name="lifebuoy" size={18} color={colors.brandStart} />
          <Text style={styles.actionText}>Escalation resources</Text>
        </Pressable>

        <View style={styles.helpCard}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.helpText} />
          <Text style={styles.helpText}>
            Keep conversations respectful, supportive, and safely escalated when needed.
          </Text>
        </View>

        <Pressable
          style={styles.logout}
          onPress={() =>
            Alert.alert("Logout", "Are you sure you want to sign out from host app?", [
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
    marginBottom: 1,
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
