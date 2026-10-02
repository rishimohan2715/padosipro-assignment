export const colors = {
  // Deep PadosiPro green from padosipro.com.
  primary: "#0E6B4F",
  primaryDark: "#07513C",
  primarySoft: "#E5F1EC",

  // Warm amber accent — mirrors the saffron/gold tones from the marketing site.
  accent: "#D97706",
  accentSoft: "#FEF3C7",

  bg: "#FAF9F6",
  surface: "#FFFFFF",
  surfaceAlt: "#F3F2EC",
  card: "#FFFFFF",
  border: "#E7E4DB",
  borderStrong: "#D5D1C4",

  text: "#111613",
  textStrong: "#000000",
  textMuted: "#6B7472",
  textOnPrimary: "#FFFFFF",

  danger: "#B91C1C",
  dangerSoft: "#FEE2E2",
  success: "#15803D",
  successSoft: "#DCFCE7",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: "#111",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cta: {
    shadowColor: "#0E6B4F",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
};

export const CATEGORY_EMOJI: Record<string, string> = {
  home: "🏠",
  errands: "📦",
  travel: "✈️",
  finance: "📑",
  lifestyle: "🌿",
};

// Deep-green gradient used on the Lifestyle Manager hero card.
export const heroGradient = ["#0E6B4F", "#0A5A42", "#064032"] as const;
