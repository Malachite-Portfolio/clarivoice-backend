export function formatPhone(phone: string) {
  const clean = phone.replace(/[^\d]/g, "");
  if (clean.length <= 4) {
    return clean;
  }

  return `+${clean.slice(0, clean.length - 10)} ${clean.slice(-10, -5)} ${clean.slice(-5)}`.trim();
}

export function shortTime(dateIso: string) {
  const date = new Date(dateIso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function shortDateTime(dateIso: string) {
  const date = new Date(dateIso);
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function callDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
