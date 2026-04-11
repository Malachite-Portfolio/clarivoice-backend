import { API_ENDPOINTS } from "@/constants/api";
import { api } from "@/services/http";
import type {
  ApiResponse,
  Host,
  HostAction,
  HostCreatePayload,
  HostListQuery,
  HostPriceLog,
  HostSessionHistoryItem,
  PaginatedResponse,
} from "@/types";

type ListenerListItem = {
  id: string;
  userId: string;
  bio?: string | null;
  rating?: number | string | null;
  experienceYears?: number | null;
  languages?: string[] | null;
  category?: string | null;
  callRatePerMinute?: number | string | null;
  chatRatePerMinute?: number | string | null;
  availability?: string | null;
  isEnabled?: boolean | null;
  totalSessions?: number | null;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id: string;
    phone?: string | null;
    email?: string | null;
    displayName?: string | null;
    status?: string | null;
    isPhoneVerified?: boolean | null;
    createdAt?: string;
  } | null;
};

type ListenerListResponse = {
  items: ListenerListItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mapHostStatus = (userStatus?: string | null, isEnabled?: boolean | null) => {
  const status = String(userStatus ?? "").toUpperCase();
  if (status === "BLOCKED") {
    return "suspended" as const;
  }
  if (status === "DELETED") {
    return "blocked" as const;
  }
  if (isEnabled === false) {
    return "inactive" as const;
  }
  return "active" as const;
};

const mapPresence = (availability?: string | null) => {
  const normalized = String(availability ?? "OFFLINE").toLowerCase();
  if (normalized === "online" || normalized === "busy") {
    return normalized as "online" | "busy";
  }
  return "offline" as const;
};

const mapVerificationStatus = (isPhoneVerified?: boolean | null) =>
  isPhoneVerified ? ("verified" as const) : ("pending" as const);

const mapListenerToHost = (item: ListenerListItem): Host => {
  const displayName = item.user?.displayName || "Anonymous Host";
  const phone = item.user?.phone || "N/A";
  const email = item.user?.email || "N/A";
  const joinedAt =
    item.user?.createdAt || item.createdAt || item.updatedAt || new Date().toISOString();
  const experienceYears = toNumber(item.experienceYears, 0);
  const rating = toNumber(item.rating, 0);
  const totalSessions = toNumber(item.totalSessions, 0);

  return {
    id: item.userId || item.user?.id || item.id,
    hostId: item.userId || item.id,
    fullName: displayName,
    displayName,
    phone,
    email,
    gender: "other",
    age: 0,
    category: item.category || "General",
    languages: Array.isArray(item.languages) ? item.languages : [],
    experienceYears,
    rating,
    reviewsCount: 0,
    quote: item.bio || "",
    bio: item.bio || "",
    skills: [],
    callRatePerMinute: toNumber(item.callRatePerMinute, 0),
    chatRatePerMinute: toNumber(item.chatRatePerMinute, 0),
    minChatBalance: 0,
    minCallBalance: 0,
    totalCalls: 0,
    totalChats: 0,
    totalMinutes: 0,
    completedSessions: totalSessions,
    cancellationRate: 0,
    revenueGenerated: 0,
    hostEarnings: 0,
    platformCommission: 0,
    status: mapHostStatus(item.user?.status, item.isEnabled),
    verificationStatus: mapVerificationStatus(item.user?.isPhoneVerified),
    visibility: item.isEnabled ? "visible" : "hidden",
    presence: mapPresence(item.availability),
    featured: false,
    blockedNewSessions: false,
    joinedAt,
    profileImageUrl: undefined,
    coverImageUrl: undefined,
    availabilitySchedule: undefined,
    adminNotes: undefined,
  };
};

const buildListenerListParams = (query: HostListQuery = {}) => ({
  ...query,
  page: query.page ?? 1,
  pageSize: query.pageSize ?? 10,
  limit: query.pageSize ?? 10,
});

const getHostByIdFromList = async (hostId: string) => {
  const response = await hostsService.getHosts({
    page: 1,
    pageSize: 100,
  });

  const host = response.items.find((item) => item.id === hostId || item.hostId === hostId);
  if (!host) {
    throw new Error("Host not found");
  }

  return host;
};

export const hostsService = {
  async getHosts(query: HostListQuery = {}) {
    const params = buildListenerListParams(query);

    const response = await api.get<ApiResponse<ListenerListResponse>>(
      API_ENDPOINTS.hosts.base,
      {
        params,
      },
    );

    const payload = response.data.data;
    const mappedItems = (payload.items ?? []).map(mapListenerToHost);

    return {
      items: mappedItems,
      page: payload.pagination?.page ?? params.page,
      pageSize: payload.pagination?.limit ?? params.pageSize,
      totalCount: payload.pagination?.total ?? mappedItems.length,
      totalPages: payload.pagination?.totalPages ?? 1,
    } satisfies PaginatedResponse<Host>;
  },

  async createHost(payload: HostCreatePayload) {
    const response = await api.post<ApiResponse<Host>>(API_ENDPOINTS.hosts.base, payload);
    return response.data.data;
  },

  async getHostById(hostId: string) {
    return getHostByIdFromList(hostId);
  },

  async updateHost(hostId: string, payload: Partial<HostCreatePayload>) {
    const requests: Promise<unknown>[] = [];

    if (
      payload.callRatePerMinute !== undefined ||
      payload.chatRatePerMinute !== undefined
    ) {
      requests.push(
        api.patch(API_ENDPOINTS.hosts.byId(`${hostId}/rates`), {
          callRatePerMinute: payload.callRatePerMinute ?? 0,
          chatRatePerMinute: payload.chatRatePerMinute ?? 0,
        }),
      );
    }

    if (payload.active !== undefined) {
      requests.push(
        api.patch(API_ENDPOINTS.hosts.byId(`${hostId}/status`), {
          userStatus: payload.active ? "ACTIVE" : "BLOCKED",
          isEnabled: Boolean(payload.active),
          availability: payload.active ? "ONLINE" : "OFFLINE",
        }),
      );
    }

    if (payload.visibleInApp !== undefined) {
      requests.push(
        api.patch(API_ENDPOINTS.hosts.byId(`${hostId}/visibility`), {
          visible: Boolean(payload.visibleInApp),
        }),
      );
    }

    if (!requests.length) {
      return getHostByIdFromList(hostId);
    }

    await Promise.all(requests);
    return getHostByIdFromList(hostId);
  },

  async updateHostAction(hostId: string, action: HostAction, payload?: unknown) {
    void payload;

    if (action === "approve") {
      await api.patch(API_ENDPOINTS.hosts.byId(`${hostId}/status`), {
        userStatus: "ACTIVE",
      });
      return getHostByIdFromList(hostId);
    }

    if (action === "reject" || action === "suspend") {
      await api.patch(API_ENDPOINTS.hosts.byId(`${hostId}/status`), {
        userStatus: "BLOCKED",
        isEnabled: false,
        availability: "OFFLINE",
      });
      return getHostByIdFromList(hostId);
    }

    if (action === "reactivate") {
      await api.patch(API_ENDPOINTS.hosts.byId(`${hostId}/status`), {
        userStatus: "ACTIVE",
        isEnabled: true,
      });
      return getHostByIdFromList(hostId);
    }

    if (action === "hide" || action === "show") {
      await api.patch(API_ENDPOINTS.hosts.byId(`${hostId}/visibility`), {
        visible: action === "show",
      });
      return getHostByIdFromList(hostId);
    }

    if (action === "forceOffline") {
      await api.patch(API_ENDPOINTS.hosts.byId(`${hostId}/status`), {
        availability: "OFFLINE",
      });
      return getHostByIdFromList(hostId);
    }

    throw new Error("This host action is not supported by the current backend API.");
  },

  async bulkAction(hostIds: string[], action: HostAction) {
    const settled = await Promise.allSettled(
      hostIds.map((id) => this.updateHostAction(id, action)),
    );

    const updatedCount = settled.filter((result) => result.status === "fulfilled").length;
    return { updatedCount };
  },

  async getHostSessionHistory(hostId: string) {
    void hostId;
    return [] as HostSessionHistoryItem[];
  },

  async getHostPricingLogs(hostId: string) {
    const response = await api.get<ApiResponse<{ items: HostPriceLog[] }>>(
      API_ENDPOINTS.hosts.pricingHistory(hostId),
    );
    return response.data.data?.items ?? [];
  },
};
