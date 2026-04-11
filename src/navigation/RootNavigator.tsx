import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { HostIncomingCallModal } from "../components/host/HostIncomingCallModal";
import { colors } from "../config/theme";
import { EditProfileScreen } from "../screens/account/EditProfileScreen";
import { GiftStoreScreen } from "../screens/account/GiftStoreScreen";
import { SettingsScreen } from "../screens/account/SettingsScreen";
import { WalletScreen } from "../screens/account/WalletScreen";
import { OnboardingScreen } from "../screens/auth/OnboardingScreen";
import { OtpScreen } from "../screens/auth/OtpScreen";
import { PhoneLoginScreen } from "../screens/auth/PhoneLoginScreen";
import { CallSessionScreen } from "../screens/calls/CallSessionScreen";
import { CallsScreen } from "../screens/calls/CallsScreen";
import { ChatThreadScreen } from "../screens/chat/ChatThreadScreen";
import { ChatsScreen } from "../screens/chat/ChatsScreen";
import { AccountScreen } from "../screens/account/AccountScreen";
import { ExploreScreen } from "../screens/home/ExploreScreen";
import { HostProfileScreen } from "../screens/home/HostProfileScreen";
import { HomeScreen } from "../screens/home/HomeScreen";
import { HostAccountScreen } from "../screens/host/HostAccountScreen";
import { HostActivityScreen } from "../screens/host/HostActivityScreen";
import { HostCallSessionScreen } from "../screens/host/HostCallSessionScreen";
import { HostCallsScreen } from "../screens/host/HostCallsScreen";
import { HostChatsScreen } from "../screens/host/HostChatsScreen";
import { HostChatThreadScreen } from "../screens/host/HostChatThreadScreen";
import { HostEarningsScreen } from "../screens/host/HostEarningsScreen";
import { HostHomeScreen } from "../screens/host/HostHomeScreen";
import { HostProfileScreen as HostSelfProfileScreen } from "../screens/host/HostProfileScreen";
import { HostSettingsScreen } from "../screens/host/HostSettingsScreen";
import { SplashScreen } from "../screens/SplashScreen";
import { updateCallState } from "../services/callService";
import { loadPreferences } from "../services/preferencesService";
import {
  clearIncomingCallNotification,
  showChatNotification,
  showIncomingCallNotification,
} from "../services/notificationService";
import {
  getMicrophonePermissionStatus,
  getNotificationPermissionStatus,
  openAppSettings,
  refreshPermissionStatuses,
  requestMicrophonePermission,
  requestNotificationPermission,
} from "../services/permissionsService";
import { startRealtime, stopRealtime, subscribeRealtime } from "../services/realtimeService";
import { useHostCallStore } from "../store/useHostCallStore";
import { usePermissionStore } from "../store/usePermissionStore";
import { useSessionStore } from "../store/useSessionStore";
import { useWalletStore } from "../store/useWalletStore";
import {
  AuthStackParamList,
  HostTabParamList,
  RootStackParamList,
  UserTabParamList,
} from "../types/navigation";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const UserTabs = createBottomTabNavigator<UserTabParamList>();
const HostTabs = createBottomTabNavigator<HostTabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

function EditProfileRouteScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "EditProfile">) {
  return <EditProfileScreen onBack={() => navigation.goBack()} />;
}

function AuthFlow() {
  const { hasSeenOnboarding } = useSessionStore();

  return (
    <AuthStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={hasSeenOnboarding ? "PhoneLogin" : "Onboarding"}
    >
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
      <AuthStack.Screen name="OtpVerify" component={OtpScreen} />
    </AuthStack.Navigator>
  );
}

function UserTabsFlow() {
  return (
    <UserTabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 68,
          paddingTop: 6,
          borderTopColor: "#E2E8F0",
          backgroundColor: colors.background,
        },
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: "#7A7A7A",
        tabBarLabelStyle: {
          fontSize: 12,
        },
      }}
    >
      <UserTabs.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <UserTabs.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="compass-outline" color={color} size={size} />
          ),
        }}
      />
      <UserTabs.Screen
        name="Chats"
        component={ChatsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="chatbubble-outline" color={color} size={size} />
              <View
                style={{
                  position: "absolute",
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.brandStart,
                  right: -1,
                  top: -1,
                }}
              />
            </View>
          ),
        }}
      />
      <UserTabs.Screen
        name="Calls"
        component={CallsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="call-outline" color={color} size={size} />,
        }}
      />
      <UserTabs.Screen
        name="Account"
        component={AccountScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </UserTabs.Navigator>
  );
}

function HostTabsFlow() {
  return (
    <HostTabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 68,
          paddingTop: 6,
          borderTopColor: "#E2E8F0",
          backgroundColor: colors.background,
        },
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: "#7A7A7A",
        tabBarLabelStyle: {
          fontSize: 12,
        },
      }}
    >
      <HostTabs.Screen
        name="HostHome"
        component={HostHomeScreen}
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard-outline" color={color} size={size} />
          ),
        }}
      />
      <HostTabs.Screen
        name="HostChats"
        component={HostChatsScreen}
        options={{
          title: "Chats",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" color={color} size={size} />,
        }}
      />
      <HostTabs.Screen
        name="HostCalls"
        component={HostCallsScreen}
        options={{
          title: "Calls",
          tabBarIcon: ({ color, size }) => <Ionicons name="call-outline" color={color} size={size} />,
        }}
      />
      <HostTabs.Screen
        name="HostAccount"
        component={HostAccountScreen}
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </HostTabs.Navigator>
  );
}

export function RootNavigator() {
  const { hydrated, session, apiBaseUrl, appRole } = useSessionStore();
  const { setWallet, upsertTransaction, clear } = useWalletStore();
  const { incomingCall, setIncomingCall, clearIncomingCall } = useHostCallStore();
  const {
    notificationPrompted,
    notificationStatus,
    setNotificationPrompted,
    setStatuses,
  } = usePermissionStore();
  const [incomingAction, setIncomingAction] = useState<"accept" | "reject" | null>(null);

  useEffect(() => {
    refreshPermissionStatuses()
      .then((statuses) => {
        setStatuses(statuses);
      })
      .catch((error) => {
        console.error("[permissions] initial refresh failed", error);
      });
  }, [setStatuses]);

  useEffect(() => {
    if (!session?.user.id) {
      return;
    }

    refreshPermissionStatuses()
      .then((statuses) => setStatuses(statuses))
      .catch((error) => {
        console.error("[permissions] session refresh failed", error);
      });
  }, [session?.user.id, setStatuses]);

  useEffect(() => {
    if (!session?.user.id || notificationPrompted) {
      return;
    }

    let active = true;

    getNotificationPermissionStatus()
      .then((status) => {
        if (!active) {
          return;
        }

        setStatuses({ notificationStatus: status });
        if (status === "granted") {
          setNotificationPrompted(true);
          return;
        }

        Alert.alert(
          "Stay updated",
          "Enable notifications so chat replies and incoming calls reach you right away.",
          [
            {
              text: "Not now",
              style: "cancel",
              onPress: () => setNotificationPrompted(true),
            },
            {
              text: status === "blocked" ? "Open settings" : "Enable",
              onPress: async () => {
                setNotificationPrompted(true);
                if (status === "blocked") {
                  await openAppSettings();
                  return;
                }

                const nextStatus = await requestNotificationPermission();
                setStatuses({ notificationStatus: nextStatus });

                if (nextStatus === "blocked") {
                  Alert.alert(
                    "Notifications are blocked",
                    "Open app settings to enable chat and call alerts.",
                    [
                      { text: "Later", style: "cancel" },
                      { text: "Open settings", onPress: () => openAppSettings() },
                    ]
                  );
                }
              },
            },
          ]
        );
      })
      .catch((error) => {
        console.error("[permissions] notification prompt failed", error);
      });

    return () => {
      active = false;
    };
  }, [notificationPrompted, session?.user.id, setNotificationPrompted, setStatuses]);

  useEffect(() => {
    if (!session?.user.id) {
      stopRealtime();
      clear();
      return;
    }

    startRealtime(session.user.id, apiBaseUrl);
    return () => {
      stopRealtime();
    };
  }, [apiBaseUrl, clear, session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) {
      return;
    }

    const unsubscribe = subscribeRealtime((event) => {
      if (session.role !== "user") {
        return;
      }
      if (
        event.type === "wallet.updated" &&
        event.payload.ownerType === "user" &&
        event.payload.ownerId === session.user.id
      ) {
        setWallet(event.payload);
      }
      if (
        event.type === "wallet.transaction" &&
        event.payload.ownerType === "user" &&
        event.payload.ownerId === session.user.id
      ) {
        upsertTransaction(event.payload);
      }
    });

    return () => unsubscribe();
  }, [session, setWallet, upsertTransaction]);

  useEffect(() => {
    if (!session?.user.id || notificationStatus !== "granted") {
      return;
    }

    const unsubscribe = subscribeRealtime((event) => {
      if (event.type === "message.created") {
        const isIncomingMessage =
          (session.role === "user" && event.payload.senderType === "host") ||
          (session.role === "host" && event.payload.senderType === "user");

        if (!isIncomingMessage) {
          return;
        }

        loadPreferences(session.user.id)
          .then((preferences) => {
            if (!preferences.notificationsEnabled) {
              return;
            }

            const senderName =
              session.role === "user" ? "New message from your host" : "New message from a user";
            return showChatNotification(senderName, event.payload);
          })
          .catch((error) => {
            console.error("[notifications] chat alert failed", error);
          });
      }

      if (event.type !== "call.updated") {
        return;
      }

      const isIncomingCall =
        (session.role === "user" &&
          event.payload.userId === session.user.id &&
          event.payload.initiatedByRole === "host") ||
        (session.role === "host" &&
          event.payload.hostId === session.user.id &&
          event.payload.initiatedByRole === "user");

      if ((event.payload.state === "calling" || event.payload.state === "ringing") && isIncomingCall) {
        loadPreferences(session.user.id)
          .then((preferences) => {
            if (!preferences.notificationsEnabled) {
              return;
            }

            return showIncomingCallNotification(event.payload);
          })
          .catch((error) => {
            console.error("[notifications] incoming call alert failed", error);
          });
        return;
      }

      if (
        event.payload.state === "connected" ||
        event.payload.state === "declined" ||
        event.payload.state === "ended" ||
        event.payload.state === "missed" ||
        event.payload.state === "failed"
      ) {
        clearIncomingCallNotification(event.payload.id).catch((error) => {
          console.error("[notifications] clear incoming call alert failed", error);
        });
      }
    });

    return () => unsubscribe();
  }, [notificationStatus, session?.role, session?.user.id]);

  useEffect(() => {
    if (!session?.user.id || session.role !== "host") {
      clearIncomingCall();
      return;
    }

    const hostId = session.user.id;
    const unsubscribe = subscribeRealtime((event) => {
      if (event.type !== "call.updated" || event.payload.hostId !== hostId) {
        return;
      }

      const call = event.payload;
      const currentIncoming = useHostCallStore.getState().incomingCall;

      if (
        (call.state === "calling" || call.state === "ringing") &&
        call.initiatedByRole === "user"
      ) {
        setIncomingCall(call);
        return;
      }

      if (!currentIncoming || currentIncoming.id !== call.id) {
        return;
      }

      if (call.state === "connecting" || call.state === "connected") {
        clearIncomingCall();
        if (navigationRef.isReady()) {
          navigationRef.navigate("HostCallSession", {
            callId: call.id,
            userId: call.userId,
            userName: call.userName,
            userAvatarUrl: call.userAvatarUrl,
          });
        }
        return;
      }

      if (call.state === "declined" || call.state === "ended" || call.state === "missed" || call.state === "failed") {
        clearIncomingCall();
      }
    });

    return () => unsubscribe();
  }, [clearIncomingCall, session?.role, session?.user.id, setIncomingCall]);

  async function handleAcceptIncomingCall() {
    if (!incomingCall || !session?.user.id || session.role !== "host") {
      return;
    }

    setIncomingAction("accept");
    try {
      const currentMicStatus = await getMicrophonePermissionStatus();
      setStatuses({ microphoneStatus: currentMicStatus });

      let resolvedMicStatus = currentMicStatus;
      if (currentMicStatus !== "granted") {
        resolvedMicStatus =
          currentMicStatus === "blocked"
            ? "blocked"
            : await requestMicrophonePermission();
        setStatuses({ microphoneStatus: resolvedMicStatus });
      }

      if (resolvedMicStatus !== "granted") {
        Alert.alert(
          "Microphone required",
          resolvedMicStatus === "blocked"
            ? "Microphone access is blocked. Open app settings to accept voice calls."
            : "Microphone access is needed before you can accept a call.",
          [
            { text: "Not now", style: "cancel" },
            ...(resolvedMicStatus === "blocked"
              ? [{ text: "Open settings", onPress: () => openAppSettings() }]
              : []),
          ]
        );
        return;
      }

      const updated = await updateCallState(
        incomingCall.id,
        session.user.id,
        "connected",
        apiBaseUrl,
        "host"
      );
      await clearIncomingCallNotification(incomingCall.id);
      clearIncomingCall();
      if (navigationRef.isReady()) {
        navigationRef.navigate("HostCallSession", {
          callId: updated.id,
          userId: updated.userId,
          userName: updated.userName,
          userAvatarUrl: updated.userAvatarUrl,
        });
      }
    } catch (error) {
      Alert.alert(
        "Could not accept call",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setIncomingAction(null);
    }
  }

  async function handleRejectIncomingCall() {
    if (!incomingCall || !session?.user.id || session.role !== "host") {
      return;
    }

    setIncomingAction("reject");
    try {
      await updateCallState(incomingCall.id, session.user.id, "declined", apiBaseUrl, "host");
      await clearIncomingCallNotification(incomingCall.id);
      clearIncomingCall();
    } catch (error) {
      Alert.alert(
        "Could not reject call",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setIncomingAction(null);
    }
  }

  if (!hydrated) {
    return <SplashScreen />;
  }

  const hasRoleMismatch = Boolean(session && session.role !== appRole);
  const showAuth = !session || hasRoleMismatch;

  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {showAuth ? (
          <RootStack.Screen name="Auth" component={AuthFlow} />
        ) : appRole === "host" ? (
          <>
            <RootStack.Screen name="HostMainTabs" component={HostTabsFlow} />
            <RootStack.Screen name="HostChatThread" component={HostChatThreadScreen} />
            <RootStack.Screen name="HostCallSession" component={HostCallSessionScreen} />
            <RootStack.Screen name="HostProfileSelf" component={HostSelfProfileScreen} />
            <RootStack.Screen name="HostSettings" component={HostSettingsScreen} />
            <RootStack.Screen name="HostActivity" component={HostActivityScreen} />
            <RootStack.Screen name="HostEarnings" component={HostEarningsScreen} />
          </>
        ) : (
          <>
            <RootStack.Screen name="UserMainTabs" component={UserTabsFlow} />
            <RootStack.Screen name="HostProfile" component={HostProfileScreen} />
            <RootStack.Screen name="ChatThread" component={ChatThreadScreen} />
            <RootStack.Screen name="CallSession" component={CallSessionScreen} />
            <RootStack.Screen name="Wallet" component={WalletScreen} />
            <RootStack.Screen name="GiftStore" component={GiftStoreScreen} />
            <RootStack.Screen name="Settings" component={SettingsScreen} />
            <RootStack.Screen name="EditProfile" component={EditProfileRouteScreen} />
          </>
        )}
      </RootStack.Navigator>
      <HostIncomingCallModal
        call={appRole === "host" && !showAuth ? incomingCall : null}
        loading={incomingAction}
        onAccept={handleAcceptIncomingCall}
        onReject={handleRejectIncomingCall}
      />
    </NavigationContainer>
  );
}
