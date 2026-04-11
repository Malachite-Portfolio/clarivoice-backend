/* eslint-disable no-console */

const BASE_URL = String(process.env.BACKEND_BASE_URL || "http://127.0.0.1:4000").replace(
  /\/+$/,
  ""
);
const DEMO_OTP = String(process.env.DEMO_OTP || "123456");

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${response.status} ${payload.message || "Request failed"} (${path})`);
  }
  return payload;
}

async function run() {
  console.log(`Smoke check backend: ${BASE_URL}`);

  const health = await request("/health");
  console.log("Health:", health.ok ? "ok" : "failed");

  const otpSession = await request("/auth/request-otp", {
    method: "POST",
    body: { phone: "9000000001", role: "user" },
  });

  const auth = await request("/auth/verify-otp", {
    method: "POST",
    body: {
      phone: "9000000001",
      role: "user",
      sessionId: otpSession.sessionId,
      otp: DEMO_OTP,
    },
  });

  const userId = auth.user.id;
  const hosts = await request(`/hosts?userId=${encodeURIComponent(userId)}`);
  if (!hosts.length) {
    throw new Error("No hosts returned.");
  }

  const hostId = hosts[0].id;
  const conversation = await request("/conversations/start", {
    method: "POST",
    body: { userId, hostId },
  });

  await request(`/conversations/${conversation.id}/messages`, {
    method: "POST",
    body: { senderId: userId, senderType: "user", text: "Smoke message from script" },
  });

  const call = await request("/calls/start", {
    method: "POST",
    body: { requesterId: userId, requesterRole: "user", counterpartId: hostId },
  });

  await request(`/calls/${call.id}/state`, {
    method: "POST",
    body: { actorId: userId, actorRole: "user", state: "ended" },
  });

  console.log("Smoke flow completed successfully.");
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
