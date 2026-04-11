import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader } from "../../components/AppHeader";
import { PillChip } from "../../components/ui/PillChip";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { SectionCard } from "../../components/ui/SectionCard";
import { colors } from "../../config/theme";
import { fetchHostProfile } from "../../services/hostService";
import { useSessionStore } from "../../store/useSessionStore";
import { Host } from "../../types/models";
import { RootStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "HostProfileSelf">;

export function HostProfileScreen({ navigation }: Props) {
  const { session, apiBaseUrl } = useSessionStore();
  const [profile, setProfile] = useState<Host | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hostId = session?.user.id ?? "";

  useFocusEffect(
    useCallback(() => {
      if (!hostId) {
        return;
      }
      setLoading(true);
      fetchHostProfile(hostId, apiBaseUrl)
        .then((result) => {
          setProfile(result);
          setError(null);
        })
        .catch((loadError) => {
          setError(loadError instanceof Error ? loadError.message : "Could not load host profile.");
        })
        .finally(() => setLoading(false));
    }, [apiBaseUrl, hostId])
  );

  return (
    <ScreenContainer>
      <AppHeader title="My Host Profile" onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brandStart} />
        </View>
      ) : profile ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <SectionCard>
            <View style={styles.headerRow}>
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
              <View style={styles.meta}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{profile.name}</Text>
                  {profile.verified ? (
                    <MaterialCommunityIcons name="check-decagram" size={16} color="#0E7490" />
                  ) : null}
                </View>
                <Text style={styles.detail}>{profile.age} years</Text>
                <Text style={styles.detail}>Availability: {profile.availability}</Text>
              </View>
            </View>
            <Text style={styles.about}>{profile.about}</Text>
          </SectionCard>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Languages</Text>
            <View style={styles.chips}>
              {profile.languages.map((item) => (
                <PillChip key={item} label={item} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.chips}>
              {profile.interests.map((item) => (
                <PillChip key={item} label={item} />
              ))}
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      ) : (
        <View style={styles.loader}>
          <Text style={styles.error}>{error ?? "Profile is unavailable."}</Text>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 1.5,
    borderColor: "#F89BB4",
  },
  meta: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginBottom: 2,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  detail: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 1,
  },
  about: {
    color: colors.textPrimary,
    marginTop: 12,
    lineHeight: 20,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: 8,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  error: {
    color: colors.danger,
    marginTop: 12,
  },
});

