import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../components/ui/AppButton";
import { AppInput } from "../../components/ui/AppInput";
import { colors } from "../../config/theme";
import { requestOtp, verifyOtp } from "../../services/authService";
import { useSessionStore } from "../../store/useSessionStore";
import { useWalletStore } from "../../store/useWalletStore";
import { AuthStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<AuthStackParamList, "OtpVerify">;

export function OtpScreen({ route }: Props) {
  const { phone } = route.params;
  const { apiBaseUrl, otpSession, setOtpSession, setSession, appRole } = useSessionStore();
  const { setWallet } = useWalletStore();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    if (!otpSession?.sessionId) {
      setError("OTP session expired. Please request a new code.");
      return;
    }
    if (otp.length !== 6) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const session = await verifyOtp(phone, otp, otpSession.sessionId, apiBaseUrl, appRole);
      setSession(session);
      if (session.wallet) {
        setWallet(session.wallet);
      }
      setOtpSession(null);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    try {
      const nextSession = await requestOtp(phone, apiBaseUrl, appRole);
      setOtpSession(nextSession);
      setOtp("");
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Could not resend OTP.");
    } finally {
      setResending(false);
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
          <Text style={styles.title}>
            {appRole === "host" ? "Verify Host OTP" : "Verify OTP"}
          </Text>
          <Text style={styles.subtitle}>Enter the code sent to {phone}</Text>

          <View style={styles.card}>
            <AppInput
              label="6-digit OTP"
              keyboardType="number-pad"
              value={otp}
              onChangeText={(value) => setOtp(value.replace(/[^\d]/g, "").slice(0, 6))}
              placeholder="000000"
              style={styles.input}
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={handleVerify}
              error={error}
            />

            <AppButton
              label="Verify & Continue"
              onPress={handleVerify}
              loading={loading}
              style={styles.buttonWrap}
            />

            <Pressable onPress={handleResend} disabled={resending} style={styles.resend}>
              {resending ? (
                <ActivityIndicator color={colors.brandStart} />
              ) : (
                <Text style={styles.resendText}>Resend OTP</Text>
              )}
            </Pressable>
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
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  title: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: 16,
  },
  card: {
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  input: {
    letterSpacing: 7,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  buttonWrap: {
    marginTop: 12,
  },
  resend: {
    height: 42,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
  },
  resendText: {
    color: colors.brandStart,
    fontWeight: "700",
  },
});
