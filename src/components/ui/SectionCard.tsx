import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, shadows } from "../../config/theme";

export function SectionCard({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    ...shadows.card,
  },
});

