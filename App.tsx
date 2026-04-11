import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppErrorBoundary } from "./src/components/AppErrorBoundary";
import { RootNavigator } from "./src/navigation/RootNavigator";
import SplashScreen from "./src/screens/SplashScreen";
import { initializeNotificationService } from "./src/services/notificationService";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    initializeNotificationService().catch((error) => {
      console.error("[notifications] init failed", error);
    });
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setShowSplash(false);
    }, 1200);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppErrorBoundary>
          {showSplash ? (
            <SplashScreen />
          ) : (
            <>
              <StatusBar style="dark" />
              <RootNavigator />
            </>
          )}
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
