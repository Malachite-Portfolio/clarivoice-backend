import { AppRole, AuthSession, OtpSession, Wallet } from "../types/models";
import { apiRequest } from "./apiClient";

export type VerifyOtpResponse = AuthSession & {
  wallet?: Wallet;
};

const AUTH_ENDPOINTS = {
  requestOtp: "/auth/request-otp",
  verifyOtp: "/auth/verify-otp",
} as const;

function maskPhone(phone: string) {
  if (phone.length <= 4) {
    return phone;
  }
  return `${"*".repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`;
}

export async function requestOtp(phone: string, baseUrl: string, role: AppRole = "user") {
  console.info("[auth] requestOtp", {
    role,
    phone: maskPhone(phone),
    url: `${baseUrl}${AUTH_ENDPOINTS.requestOtp}`,
  });

  return apiRequest<OtpSession>(AUTH_ENDPOINTS.requestOtp, {
    method: "POST",
    baseUrl,
    body: { phone, role },
  });
}

export async function verifyOtp(
  phone: string,
  otp: string,
  sessionId: string,
  baseUrl: string,
  role: AppRole = "user"
) {
  console.info("[auth] verifyOtp", {
    role,
    phone: maskPhone(phone),
    sessionId,
    url: `${baseUrl}${AUTH_ENDPOINTS.verifyOtp}`,
  });

  return apiRequest<VerifyOtpResponse>(AUTH_ENDPOINTS.verifyOtp, {
    method: "POST",
    baseUrl,
    body: { phone, otp, sessionId, role },
  });
}
