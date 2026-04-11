import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../config/theme";
import { AppPermissionStatus } from "../../services/permissionsService";

type PermissionStatusCardProps = {
  title: string;
  description: string;
  status: AppPermissionStatus;
  actionLabel?: string;
  onActionPress?: () => void;
};

const STATUS_LABELS: Record<AppPermissionStatus, string> = {
  unknown: "Not checked",
  granted: "Allowed",
  denied: "Not allowed",
  blocked: "Open settings",
  unavailable: "Unavailable",
};

export function PermissionStatusCard({
  title,
  description,
  status,
  actionLabel,
  onActionPress,
}: PermissionStatusCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        <View style={[styles.badge, status === "granted" ? styles.badgeAllowed : styles.badgeMuted]}>
          <Text style={[styles.badgeText, status === "granted" ? styles.badgeTextAllowed : null]}>
            {STATUS_LABELS[status]}
          </Text>
        </View>
      </View>
      {actionLabel && onActionPress ? (
        <Pressable style={styles.actionButton} onPress={onActionPress}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    gap: 10,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.textPrimary,
    fontWeight: "800",
  },
  description: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeAllowed: {
    backgroundColor: "#DCFCE7",
  },
  badgeMuted: {
    backgroundColor: "#F1F5F9",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textSecondary,
  },
  badgeTextAllowed: {
    color: "#166534",
  },
  actionButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.brandStart,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
});
