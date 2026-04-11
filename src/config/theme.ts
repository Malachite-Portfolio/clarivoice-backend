export const colors = {
  background: "#F7F3F5",
  surface: "#FFFFFF",
  surfaceSoft: "#FFF8FA",
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  muted: "#94A3B8",
  border: "#E2E8F0",
  borderSoft: "#F5D7E1",
  danger: "#EF4444",
  success: "#22C55E",
  brandStart: "#F20D46",
  brandEnd: "#FF477E",
  brandSoft: "#FFEAF1",
  chipBg: "#FFEDD5",
  chipText: "#C2410C",
  onlineBg: "#DCFCE7",
  onlineText: "#16A34A",
  helpBg: "#FFF1F2",
  helpText: "#BE123C",
  shadow: "#000000",
};

export const spacing = {
  xxs: 4,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  full: 999,
};

export const typography = {
  display: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800" as const,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800" as const,
  },
  heading: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800" as const,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
  },
};

export const shadows = {
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
};
