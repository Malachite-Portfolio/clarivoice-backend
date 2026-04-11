import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radius } from "../../config/theme";

type AppButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "outline";
  style?: StyleProp<ViewStyle>;
};

export function AppButton({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
  style,
}: AppButtonProps) {
  const inactive = Boolean(disabled || loading);

  if (variant === "outline") {
    return (
      <Pressable
        onPress={onPress}
        disabled={inactive}
        style={({ pressed }) => [styles.outlineButton, inactive && styles.inactive, pressed && styles.pressed, style]}
      >
        {loading ? <ActivityIndicator color={colors.brandStart} /> : <Text style={styles.outlineText}>{label}</Text>}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} disabled={inactive} style={[style, inactive && styles.inactive]}>
      <LinearGradient
        colors={[colors.brandStart, colors.brandEnd]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.primaryButton}
      >
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    height: 52,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  outlineButton: {
    height: 52,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
  },
  outlineText: {
    color: colors.brandStart,
    fontSize: 15,
    fontWeight: "700",
  },
  inactive: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
});

