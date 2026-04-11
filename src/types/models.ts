export type AppRole = "user" | "host";
export type AvailabilityStatus = "online" | "offline" | "busy";

export type User = {
  id: string;
  phone: string;
  displayName: string;
  role: AppRole;
  avatarUrl?: string;
};

export type AuthSession = {
  token: string;
  user: User;
  role: AppRole;
};

export type OtpSession = {
  sessionId: string;
  phone: string;
  otp: string;
  expiresAt: string;
  role: AppRole;
};

export type Host = {
  id: string;
  name: string;
  age: number;
  languages: string[];
  interests: string[];
  isOnline: boolean;
  availability: AvailabilityStatus;
  verified: boolean;
  about: string;
  avatarUrl: string;
  blocked?: boolean;
  blockedByUser?: boolean;
  blockedByHost?: boolean;
  isCallAvailable?: boolean;
  isMessageAvailable?: boolean;
};

export type ConversationPreview = {
  id: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl: string;
  hostOnline: boolean;
  hostVerified: boolean;
  userId: string;
  userName: string;
  userAvatarUrl: string;
  counterpartId: string;
  counterpartName: string;
  counterpartAvatarUrl: string;
  counterpartOnline: boolean;
  counterpartVerified: boolean;
  roleView: AppRole;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

export type GiftCategory = "small" | "premium" | "luxury";

export type GiftItem = {
  id: string;
  name: string;
  category: GiftCategory;
  coinCost: number;
  icon: string;
};

export type MessageKind = "text" | "gift" | "system";

export type Message = {
  id: string;
  conversationId: string;
  senderType: "user" | "host";
  senderId: string;
  kind: MessageKind;
  text: string;
  gift?: GiftItem | null;
  deliveryState: "sent" | "delivered" | "read";
  createdAt: string;
  readBy: string[];
};

export type CallState =
  | "calling"
  | "ringing"
  | "accepted"
  | "connecting"
  | "connected"
  | "declined"
  | "ended"
  | "missed"
  | "failed";

export type CallRecord = {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl: string;
  initiatedByRole: AppRole;
  state: CallState;
  startedAt: string;
  connectedAt?: string | null;
  endedAt?: string | null;
  durationSec: number;
  billedMinutes?: number;
  chargedCoins?: number;
};

export type ApiErrorPayload = {
  message: string;
};

export type WalletOwnerType = "user" | "host";

export type Wallet = {
  ownerId: string;
  ownerType: WalletOwnerType;
  balance: number;
  updatedAt: string;
};

export type WalletTransactionType =
  | "topup_success"
  | "topup_failed"
  | "gift_sent"
  | "gift_received"
  | "call_charge"
  | "call_income"
  | "refund"
  | "withdrawal_paid"
  | "admin_credit"
  | "admin_debit";

export type WalletTransaction = {
  id: string;
  ownerId: string;
  ownerType: WalletOwnerType;
  type: WalletTransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  relatedEntityId?: string;
  createdAt: string;
};

export type TopupIntent = {
  intentId: string;
  status: "pending" | "success" | "failed";
  amountInr: number;
  coins: number;
  createdAt: string;
};

export type HostDashboard = {
  hostId: string;
  availability: AvailabilityStatus;
  activeConversations: number;
  unreadMessages: number;
  ongoingCalls: number;
  totalEarnings: number;
  todayEarnings: number;
  giftsReceived: number;
};

export type WithdrawalStatus =
  | "PENDING"
  | "APPROVED"
  | "IN_PROGRESS"
  | "PAYMENT_DONE"
  | "REJECTED"
  | "pending"
  | "approved"
  | "rejected"
  | "paid";

export type WithdrawalRequest = {
  id: string;
  listenerId?: string | null;
  hostId?: string;
  hostName?: string;
  hostPhone?: string;
  amount: number;
  amountCoins?: number;
  status: WithdrawalStatus;
  requestedAt: string;
  createdAt: string;
  updatedAt: string;
  adminNote?: string | null;
  transactionReference?: string | null;
};

export type RealtimeEvent =
  | { type: "message.created"; payload: Message }
  | { type: "conversation.updated"; payload: ConversationPreview }
  | { type: "call.updated"; payload: CallRecord }
  | {
      type: "safety.block.updated";
      payload: {
        userId: string;
        hostId: string;
        blockedByUser: boolean;
        blockedByHost: boolean;
      };
    }
  | { type: "wallet.updated"; payload: Wallet }
  | { type: "wallet.transaction"; payload: WalletTransaction }
  | { type: "host.availability.updated"; payload: { hostId: string; availability: AvailabilityStatus } }
  | { type: "connected"; payload: { userId: string } };
