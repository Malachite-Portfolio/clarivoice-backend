import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius } from "../../config/theme";

type PillChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
};

export function PillChip({ label, active, onPress }: PillChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  chipActive: {
    borderColor: "#F59AB2",
    backgroundColor: colors.brandSoft,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  textActive: {
    color: "#9F1239",
  },
});

