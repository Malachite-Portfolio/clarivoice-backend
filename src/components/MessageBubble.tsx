import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../config/theme";
import { Message } from "../types/models";
import { shortTime } from "../utils/format";

type MessageBubbleProps = {
  message: Message;
  isMine: boolean;
};

export function MessageBubble({ message, isMine }: MessageBubbleProps) {
  const gift = message.kind === "gift" ? message.gift ?? null : null;
  const statusText = isMine
    ? message.deliveryState === "read"
      ? "Read"
      : message.deliveryState === "delivered"
        ? "Delivered"
        : "Sent"
    : "";

  return (
    <View style={[styles.row, isMine ? styles.mineRow : styles.otherRow]}>
      <View style={[styles.bubble, isMine ? styles.mineBubble : styles.otherBubble]}>
        {gift ? (
          <View>
            <Text style={[styles.giftTitle, isMine && styles.mineText]}>
              {gift.icon} {gift.name}
            </Text>
            <Text style={[styles.giftMeta, isMine && styles.mineTime]}>
              {gift.category.toUpperCase()} - {gift.coinCost} coins
            </Text>
            <Text style={[styles.text, styles.giftText, isMine && styles.mineText]}>
              {message.text}
            </Text>
          </View>
        ) : (
          <Text style={[styles.text, isMine && styles.mineText]}>{message.text}</Text>
        )}
        <Text style={[styles.time, isMine && styles.mineTime]}>
          {shortTime(message.createdAt)}
          {statusText ? ` - ${statusText}` : ""}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    marginBottom: 10,
    flexDirection: "row",
  },
  mineRow: {
    justifyContent: "flex-end",
  },
  otherRow: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },
  mineBubble: {
    backgroundColor: "#FFE5EC",
    borderColor: "#FFC1D0",
    borderBottomRightRadius: 8,
  },
  otherBubble: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderBottomLeftRadius: 8,
  },
  text: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
  },
  mineText: {
    color: "#8A0D31",
  },
  time: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "right",
  },
  mineTime: {
    color: "#9B4E64",
  },
  giftTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  giftMeta: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  giftText: {
    marginTop: 6,
  },
});
