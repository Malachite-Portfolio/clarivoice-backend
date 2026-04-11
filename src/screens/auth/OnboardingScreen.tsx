import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image, StyleSheet, Text, View } from "react-native";
import { AppButton } from "../../components/ui/AppButton";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { SectionCard } from "../../components/ui/SectionCard";
import { colors, typography } from "../../config/theme";
import { useSessionStore } from "../../store/useSessionStore";
import { AuthStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<AuthStackParamList, "Onboarding">;

const splashLogo = require("../../../assets/splash-icon.png");

const points = [
  "Talk to verified hosts in a safe and respectful space.",
  "Real-time chat and call support when you need someone to listen.",
  "Block/report controls and trust-first moderation architecture.",
];

export function OnboardingScreen({ navigation }: Props) {
  const { appRole, setHasSeenOnboarding } = useSessionStore();

  function handleContinue() {
    setHasSeenOnboarding(true);
    navigation.replace("PhoneLogin");
  }

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <View style={styles.hero}>
        <Image source={splashLogo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>
          {appRole === "host" ? "Welcome to Feely Host" : "Welcome to FeelyTalk"}
        </Text>
        <Text style={styles.subtitle}>
          {appRole === "host"
            ? "Support users with empathy and professional boundaries."
            : "A calm, supportive space for emotionally low moments."}
        </Text>
      </View>

      <SectionCard>
        <Text style={styles.cardTitle}>What you can expect</Text>
        {points.map((point) => (
          <View key={point} style={styles.pointRow}>
            <View style={styles.dot} />
            <Text style={styles.pointText}>{point}</Text>
          </View>
        ))}
      </SectionCard>

      <View style={styles.footer}>
        <AppButton label="Get Started" onPress={handleContinue} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingBottom: 20,
  },
  hero: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 16,
  },
  logo: {
    width: 180,
    height: 64,
    marginBottom: 20,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
  },
  cardTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    fontSize: 16,
    marginBottom: 10,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.brandStart,
    marginTop: 7,
  },
  pointText: {
    ...typography.body,
    flex: 1,
    color: colors.textSecondary,
  },
  footer: {
    marginTop: 16,
  },
});

