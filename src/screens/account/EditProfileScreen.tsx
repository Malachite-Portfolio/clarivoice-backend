import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "../../components/AppHeader";
import { colors } from "../../config/theme";
import { useSessionStore } from "../../store/useSessionStore";

type Gender = "Female" | "Male" | "Other";

export function EditProfileScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { session, updateDisplayName } = useSessionStore();
  const [name, setName] = useState(session?.user.displayName ?? "Jessica");
  const [age, setAge] = useState("26");
  const [gender, setGender] = useState<Gender>("Female");

  const canSave = useMemo(() => name.trim().length > 1, [name]);

  function handleSave() {
    if (!canSave) {
      Alert.alert("Name required", "Please enter a valid display name.");
      return;
    }
    updateDisplayName(name.trim());
    Alert.alert("Profile updated", "Your profile was saved for this session.");
    onBack();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <AppHeader title="Edit Profile" onBack={onBack} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatar} />

          <Text style={styles.label}>Nick Name</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} />

          <Text style={[styles.label, styles.sectionTop]}>Select Your Gender</Text>
          <View style={styles.genderRow}>
            {(["Female", "Male", "Other"] as const).map((item) => (
              <Pressable key={item} onPress={() => setGender(item)} style={styles.genderButtonWrap}>
                {gender === item ? (
                  <LinearGradient
                    colors={[colors.brandStart, colors.brandEnd]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.genderActive}
                  >
                    <Text style={styles.genderActiveText}>{item}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.genderIdle}>
                    <Text style={styles.genderIdleText}>{item}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, styles.sectionTop]}>Enter Age</Text>
          <TextInput
            value={age}
            onChangeText={(value) => setAge(value.replace(/[^\d]/g, "").slice(0, 2))}
            keyboardType="number-pad"
            style={styles.input}
          />
        </ScrollView>

        <Pressable onPress={handleSave} style={[styles.saveWrap, { paddingBottom: insets.bottom + 12 }]}>
          <LinearGradient
            colors={[colors.brandStart, colors.brandEnd]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.saveButton, !canSave && styles.disabled]}
          >
            <Text style={styles.saveText}>Update</Text>
          </LinearGradient>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFF8F9",
  },
  keyboardWrap: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  content: {
    paddingBottom: 20,
  },
  avatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "#FFD5E1",
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  label: {
    color: colors.textPrimary,
    fontWeight: "700",
    marginLeft: 6,
    marginBottom: 8,
    fontSize: 15,
  },
  sectionTop: {
    marginTop: 18,
  },
  input: {
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: "#F2B8C8",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    fontSize: 16,
    color: "#525252",
  },
  genderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  genderButtonWrap: {
    flexGrow: 1,
    flexBasis: "31%",
    minWidth: 90,
  },
  genderActive: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  genderActiveText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  genderIdle: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F2B8C8",
    backgroundColor: "#FFFFFF",
  },
  genderIdleText: {
    color: "#969696",
    fontWeight: "600",
  },
  saveWrap: {
    paddingHorizontal: 6,
    paddingTop: 8,
  },
  saveButton: {
    height: 60,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.7,
  },
});
