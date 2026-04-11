import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../components/ui/AppButton";
import { AppInput } from "../../components/ui/AppInput";
import { colors } from "../../config/theme";
import { requestOtp } from "../../services/authService";
import { useSessionStore } from "../../store/useSessionStore";
import { AuthStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<AuthStackParamList, "PhoneLogin">;

export function PhoneLoginScreen({ navigation }: Props) {
  const { apiBaseUrl, setOtpSession, appRole } = useSessionStore();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    const normalizedPhone = phone.replace(/[^\d]/g, "");
    if (normalizedPhone.length < 8) {
      setError("Please enter a valid phone number.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.info("[auth] login attempt", {
        appRole,
        apiBaseUrl,
        phone: normalizedPhone,
      });
      const otpSession = await requestOtp(normalizedPhone, apiBaseUrl, appRole);
      setOtpSession(otpSession);
      navigation.navigate("OtpVerify", { phone: normalizedPhone });
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to request OTP right now. Please try again.";
      console.error("[auth] login attempt failed", {
        appRole,
        apiBaseUrl,
        phone: normalizedPhone,
        message,
      });
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Text style={styles.title}>
              {appRole === "host" ? "Welcome to Feely Host" : "Welcome to FeelyTalk"}
            </Text>
            <Text style={styles.subtitle}>
              {appRole === "host"
                ? "Host dashboard login for supportive conversations with users."
                : "A calm, supportive space to connect with verified listeners when you need someone."}
            </Text>
          </View>

          <View style={styles.card}>
            <AppInput
              label={appRole === "host" ? "Host Phone Number" : "Phone Number"}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter phone number"
              value={phone}
              onChangeText={setPhone}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              error={error}
            />

            <AppButton
              label="Get OTP"
              onPress={handleContinue}
              loading={loading}
              style={styles.buttonWrap}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardWrap: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
    paddingVertical: 20,
  },
  hero: {
    marginBottom: 20,
  },
  title: {
    fontSize: 30 / 2,
    color: colors.textPrimary,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textSecondary,
    lineHeight: 20,
    fontSize: 14,
  },
  card: {
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  buttonWrap: {
    marginTop: 8,
  },
});
