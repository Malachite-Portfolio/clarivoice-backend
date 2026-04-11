import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../config/theme";

type HostSummaryCardProps = {
  title: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  subtitle?: string;
};

export function HostSummaryCard({ title, value, icon, subtitle }: HostSummaryCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name={icon} size={16} color={colors.brandStart} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  title: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  value: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: 22,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
});

