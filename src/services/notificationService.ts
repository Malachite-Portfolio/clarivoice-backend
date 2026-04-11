import * as Notifications from "expo-notifications";
import { Platform, Vibration } from "react-native";
import { CallRecord, Message } from "../types/models";

const CHANNELS = {
  general: "general-alerts",
  chat: "chat-messages",
  calls: "incoming-calls",
} as const;

let initialized = false;
const incomingCallNotifications = new Map<string, string>();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function initializeNotificationService() {
  if (initialized) {
    return;
  }

  if (Platform.OS !== "android") {
    initialized = true;
    return;
  }

  await Promise.all([
    Notifications.setNotificationChannelAsync(CHANNELS.general, {
      name: "General alerts",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
      enableVibrate: true,
      vibrationPattern: [0, 150, 100, 150],
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.chat, {
      name: "Chat messages",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      enableVibrate: true,
      vibrationPattern: [0, 150, 75, 150],
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.calls, {
      name: "Incoming calls",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      enableVibrate: true,
      vibrationPattern: [0, 350, 200, 350],
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: {
          enforceAudibility: false,
          requestHardwareAudioVideoSynchronization: false,
        },
      },
    }),
  ]);

  initialized = true;
}

function getMessageBody(message: Message) {
  if (message.kind === "gift" && message.gift) {
    return `Sent a ${message.gift.name}.`;
  }

  if (message.kind === "system") {
    return message.text || "There is a new update in this conversation.";
  }

  return message.text || "Open the chat to continue the conversation.";
}

export async function showChatNotification(senderName: string, message: Message) {
  await initializeNotificationService();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: senderName,
      body: getMessageBody(message),
      sound: "default",
      data: {
        type: "chat-message",
        conversationId: message.conversationId,
        messageId: message.id,
      },
    },
    trigger: null,
  });
}

export async function showIncomingCallNotification(call: CallRecord) {
  await initializeNotificationService();

  if (incomingCallNotifications.has(call.id)) {
    return;
  }

  const callerName = call.initiatedByRole === "user" ? call.userName : call.hostName;
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Incoming call",
      body: `${callerName} is calling you now.`,
      sound: "default",
      data: {
        type: "incoming-call",
        callId: call.id,
      },
    },
    trigger: null,
  });

  incomingCallNotifications.set(call.id, identifier);
  Vibration.vibrate([0, 350, 200, 350], true);
}

export async function clearIncomingCallNotification(callId?: string) {
  if (Platform.OS !== "android") {
    return;
  }

  if (callId) {
    const notificationId = incomingCallNotifications.get(callId);
    if (notificationId) {
      await Notifications.dismissNotificationAsync(notificationId);
      incomingCallNotifications.delete(callId);
    }
  } else {
    const notificationIds = [...incomingCallNotifications.values()];
    await Promise.all(notificationIds.map((notificationId) => Notifications.dismissNotificationAsync(notificationId)));
    incomingCallNotifications.clear();
  }

  Vibration.cancel();
}
