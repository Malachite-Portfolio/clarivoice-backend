import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { colors, radius } from "../../config/theme";

type AppInputProps = TextInputProps & {
  label?: string;
  error?: string | null;
};

export function AppInput({ label, error, style, ...props }: AppInputProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...props}
        placeholderTextColor={colors.muted}
        style={[styles.input, style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
  label: {
    color: colors.textPrimary,
    fontWeight: "600",
    marginBottom: 6,
    fontSize: 13,
  },
  input: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  error: {
    marginTop: 6,
    color: colors.danger,
    fontSize: 12,
  },
});

