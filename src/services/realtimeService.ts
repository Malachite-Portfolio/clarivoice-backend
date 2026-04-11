import { toWebSocketUrl } from "../config/runtime";
import { RealtimeEvent } from "../types/models";

type RealtimeListener = (event: RealtimeEvent) => void;
type RealtimeConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";
type RealtimeConnectionListener = (status: RealtimeConnectionStatus) => void;

let socket: WebSocket | null = null;
let currentUserId: string | null = null;
let currentBaseUrl: string | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<RealtimeListener>();
const connectionListeners = new Set<RealtimeConnectionListener>();
let connectionStatus: RealtimeConnectionStatus = "disconnected";

function notifyConnection(status: RealtimeConnectionStatus) {
  connectionStatus = status;
  connectionListeners.forEach((listener) => listener(status));
}

function notify(event: RealtimeEvent) {
  listeners.forEach((listener) => {
    listener(event);
  });
}

function resetReconnectState() {
  reconnectAttempts = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (!currentUserId || !currentBaseUrl || reconnectTimer) {
    return;
  }

  reconnectAttempts += 1;
  const backoff = Math.min(1000 * 2 ** (reconnectAttempts - 1), 15000);
  notifyConnection("reconnecting");

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (currentBaseUrl && currentUserId) {
      connect(currentBaseUrl, currentUserId);
    }
  }, backoff);
}

function connect(baseUrl: string, userId: string) {
  const wsBase = toWebSocketUrl(baseUrl);
  const url = `${wsBase}/ws?userId=${encodeURIComponent(userId)}`;
  notifyConnection(reconnectAttempts > 0 ? "reconnecting" : "connecting");
  const nextSocket = new WebSocket(url);
  socket = nextSocket;

  nextSocket.onopen = () => {
    resetReconnectState();
    notifyConnection("connected");
  };

  nextSocket.onmessage = (message) => {
    try {
      const raw = typeof message.data === "string" ? message.data : String(message.data);
      const data = JSON.parse(raw) as RealtimeEvent;
      notify(data);
    } catch {
      // Ignore malformed payload from transport noise.
    }
  };

  nextSocket.onclose = () => {
    if (socket === nextSocket) {
      socket = null;
    }
    notifyConnection("disconnected");
    scheduleReconnect();
  };

  nextSocket.onerror = () => {
    // onclose handles retry path.
  };
}

export function startRealtime(userId: string, baseUrl: string) {
  if (currentUserId === userId && currentBaseUrl === baseUrl && socket) {
    return;
  }

  stopRealtime();
  currentUserId = userId;
  currentBaseUrl = baseUrl;
  connect(baseUrl, userId);
}

export function stopRealtime() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (socket) {
    socket.close();
    socket = null;
  }

  currentUserId = null;
  currentBaseUrl = null;
  reconnectAttempts = 0;
  notifyConnection("disconnected");
}

export function subscribeRealtime(listener: RealtimeListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRealtimeConnectionStatus() {
  return connectionStatus;
}

export function subscribeRealtimeConnection(listener: RealtimeConnectionListener) {
  connectionListeners.add(listener);
  listener(connectionStatus);
  return () => {
    connectionListeners.delete(listener);
  };
}
