import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, StyleSheet, Text, View } from "react-native";
import { CallRecord } from "../../types/models";
import { colors } from "../../config/theme";
import { AppButton } from "../ui/AppButton";

type HostIncomingCallModalProps = {
  call: CallRecord | null;
  loading?: "accept" | "reject" | null;
  onAccept: () => void;
  onReject: () => void;
};

export function HostIncomingCallModal({
  call,
  loading,
  onAccept,
  onReject,
}: HostIncomingCallModalProps) {
  return (
    <Modal visible={Boolean(call)} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.badge}>INCOMING CALL</Text>
          <Image source={{ uri: call?.userAvatarUrl }} style={styles.avatar} />
          <Text style={styles.name}>{call?.userName}</Text>
          <Text style={styles.subtitle}>User wants to talk with you now</Text>
          <Text style={styles.ringingText}>{call?.state === "ringing" ? "Ringing..." : "Waiting..."}</Text>

          <View style={styles.statusRow}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.statusText}>State: {call?.state ?? "ringing"}</Text>
          </View>

          <View style={styles.actionRow}>
            <AppButton
              label="Reject"
              onPress={onReject}
              variant="outline"
              loading={loading === "reject"}
              style={styles.actionButton}
            />
            <AppButton
              label="Accept"
              onPress={onAccept}
              loading={loading === "accept"}
              style={styles.actionButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#090B10",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    minHeight: "82%",
    borderRadius: 28,
    backgroundColor: "#0F131B",
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    color: "#E5E7EB",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  avatar: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 3,
    borderColor: "#374151",
    marginBottom: 14,
  },
  name: {
    color: "#F9FAFB",
    fontWeight: "800",
    fontSize: 28,
  },
  subtitle: {
    color: "#9CA3AF",
    marginTop: 5,
    marginBottom: 8,
    fontSize: 14,
  },
  ringingText: {
    color: "#F43F5E",
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 12,
  },
  statusText: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
    marginTop: 18,
  },
  actionButton: {
    flex: 1,
  },
});
