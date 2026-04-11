import React from "react";
import {
  ActivityIndicator,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const splashLogo = require("../../asset/img/feelynew.png");

export function SplashScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
      <View style={styles.container}>
        <View style={styles.logoWrapper}>
          <Image source={splashLogo} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.loadingWrapper}>
          <Text style={styles.loadingText}>Loading</Text>
          <ActivityIndicator size="small" color="#F04D69" style={styles.loader} />
        </View>
      </View>
    </SafeAreaView>
  );
}

export default SplashScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  logoWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -80,
  },
  logo: {
    width: 300,
    height: 140,
  },
  loadingWrapper: {
    position: "absolute",
    bottom: 180,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#F04D69",
  },
  loader: {
    marginLeft: 10,
    transform: [{ scale: 1.3 }],
  },
});
