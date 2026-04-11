import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../config/theme";

type AppHeaderProps = {
  title: string;
  onBack?: () => void;
  rightElement?: ReactNode;
};

export function AppHeader({ title, onBack, rightElement }: AppHeaderProps) {
  return (
    <View style={styles.container}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
      ) : (
        <View style={styles.backSpacer} />
      )}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{rightElement}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  backSpacer: {
    width: 36,
    height: 36,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 24 / 2,
    fontWeight: "700",
    marginLeft: 4,
  },
  right: {
    minWidth: 36,
    alignItems: "flex-end",
  },
});
