import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AvailabilityStatus } from "../../types/models";
import { colors } from "../../config/theme";

const OPTIONS: AvailabilityStatus[] = ["online", "busy", "offline"];

type HostStatusToggleProps = {
  value: AvailabilityStatus;
  loading?: AvailabilityStatus | null;
  onChange: (value: AvailabilityStatus) => void;
};

export function HostStatusToggle({ value, loading, onChange }: HostStatusToggleProps) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((status) => {
        const isActive = value === status;
        const isBusy = loading === status;

        return (
          <Pressable
            key={status}
            style={[styles.chip, isActive && styles.chipActive]}
            onPress={() => onChange(status)}
            disabled={Boolean(loading)}
          >
            {isBusy ? (
              <ActivityIndicator color={isActive ? "#FFFFFF" : colors.brandStart} size="small" />
            ) : (
              <Text style={[styles.text, isActive && styles.textActive]}>{status}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    height: 34,
    minWidth: 86,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  chipActive: {
    borderColor: "#F59AB2",
    backgroundColor: colors.brandStart,
  },
  text: {
    color: colors.textSecondary,
    fontWeight: "600",
    textTransform: "capitalize",
    fontSize: 13,
  },
  textActive: {
    color: "#FFFFFF",
  },
});

