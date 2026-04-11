import { LinearGradient } from "expo-linear-gradient";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows } from "../config/theme";
import { Host } from "../types/models";

type HostCardProps = {
  host: Host;
  onTalkNow: () => void;
  onCall: () => void;
  onViewProfile?: () => void;
  showCallAction?: boolean;
};

export function HostCard({
  host,
  onTalkNow,
  onCall,
  onViewProfile,
  showCallAction = true,
}: HostCardProps) {
  const isBlocked = Boolean(host.blockedByUser || host.blockedByHost || host.blocked);
  const isCallAvailable =
    host.isCallAvailable !== undefined
      ? host.isCallAvailable
      : host.availability === "online" && !isBlocked;

  const availabilityLabel = isBlocked
    ? "Blocked"
    : host.availability === "online"
      ? "Online"
      : host.availability === "busy"
        ? "Busy"
        : "Offline";

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Pressable onPress={onViewProfile} disabled={!onViewProfile}>
          <Image source={{ uri: host.avatarUrl }} style={styles.avatar} />
        </Pressable>
        <View style={styles.onlineChip}>
          <Text style={styles.onlineText}>{availabilityLabel}</Text>
        </View>
      </View>

      <View style={styles.middle}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{host.name}</Text>
          <Text style={styles.age}>{host.age}</Text>
        </View>
        <Text style={styles.languages}>{host.languages.join(" \u2022 ")}</Text>
        <View style={styles.tags}>
          {host.interests.slice(0, 1).map((interest) => (
            <View key={interest} style={styles.tag}>
              <Text style={styles.tagText}>{interest}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.right}>
        <Pressable onPress={onTalkNow}>
          <LinearGradient
            colors={[colors.brandStart, colors.brandEnd]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.talkButton}
          >
            <Text style={styles.talkText}>Talk Now</Text>
          </LinearGradient>
        </Pressable>
        {showCallAction ? (
          <Pressable
            style={[styles.callButton, !isCallAvailable && styles.callButtonDisabled]}
            onPress={onCall}
            disabled={!isCallAvailable}
          >
            <Text style={[styles.callText, !isCallAvailable && styles.callTextDisabled]}>
              {isBlocked
                ? "Blocked"
                : host.availability === "busy"
                  ? "Busy"
                  : host.availability === "offline"
                    ? "Offline"
                    : "Call"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    backgroundColor: colors.surfaceSoft,
    padding: 12,
    marginBottom: 12,
    ...shadows.card,
  },
  left: {
    width: 78,
    alignItems: "center",
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: "#E64C58",
  },
  onlineChip: {
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: colors.onlineBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  onlineText: {
    color: colors.onlineText,
    fontSize: 10,
    fontWeight: "500",
  },
  middle: {
    flex: 1,
    marginHorizontal: 8,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  age: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  languages: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  tags: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  tag: {
    alignSelf: "flex-start",
    borderRadius: 6,
    backgroundColor: colors.chipBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    color: colors.chipText,
    fontSize: 10,
    fontWeight: "500",
  },
  right: {
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  talkButton: {
    borderRadius: radius.full,
    minWidth: 118,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    ...shadows.card,
  },
  talkText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  callButton: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "#F5A8BA",
    minWidth: 84,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    backgroundColor: "#FFF7FA",
  },
  callButtonDisabled: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E2E8F0",
  },
  callText: {
    color: "#BE123C",
    fontSize: 12,
    fontWeight: "600",
  },
  callTextDisabled: {
    color: colors.muted,
  },
});
