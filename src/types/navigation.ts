export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  UserMainTabs: undefined;
  HostMainTabs: undefined;
  HostProfile: {
    hostId: string;
  };
  ChatThread: {
    conversationId: string;
    hostId: string;
    hostName: string;
    hostAvatarUrl: string;
    hostVerified: boolean;
  };
  CallSession: {
    hostId: string;
    hostName: string;
    hostAvatarUrl: string;
    callId?: string;
  };
  Wallet: undefined;
  GiftStore: undefined;
  Settings: undefined;
  EditProfile: undefined;
  HostChatThread: {
    conversationId: string;
    userId: string;
    userName: string;
    userAvatarUrl: string;
  };
  HostCallSession: {
    userId: string;
    userName: string;
    userAvatarUrl: string;
    callId?: string;
  };
  HostProfileSelf: undefined;
  HostSettings: undefined;
  HostActivity: undefined;
  HostEarnings: undefined;
};

export type AuthStackParamList = {
  Onboarding: undefined;
  PhoneLogin: undefined;
  OtpVerify: {
    phone: string;
  };
};

export type UserTabParamList = {
  Home: undefined;
  Explore: undefined;
  Chats: undefined;
  Calls: undefined;
  Account: undefined;
};

export type HostTabParamList = {
  HostHome: undefined;
  HostChats: undefined;
  HostCalls: undefined;
  HostAccount: undefined;
};
