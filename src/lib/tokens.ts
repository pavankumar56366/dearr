/**
 * Dearr V1 Design System Tokens
 * Source of Truth: docs/4.DESIGN(1) (1).md
 */

export const DEARR_COLORS = {
  // Brand Colors
  primary: "#A2CB8B",
  secondary: "#FFCB56",
  canvas: "#FFFDF8",
  surface: "#FFFFFF",

  // Neutrals
  neutral900: "#202124",
  neutral700: "#4A4A4A",
  neutral500: "#777777",
  neutral300: "#D9D9D9",
  neutral100: "#F5F5F2",

  // Semantics
  success: "#2A7C13",
  warning: "#C00707",
  error: "#C00707",
  info: "#2E6FA3",
} as const;

export const DEARR_SPACING = {
  space1: "4px",
  space2: "8px",
  space3: "12px",
  space4: "16px",
  space6: "24px",
  space8: "32px",
  space10: "40px",
  space12: "48px",
  space14: "56px",
  space16: "64px",
} as const;

export const DEARR_RADII = {
  control: "10px",
  input: "12px",
  button: "12px",
  card: "16px",
  modal: "20px",
  sheet: "24px",
  sheetTop: "24px 24px 0 0",
  pill: "999px",
} as const;

export const DEARR_TYPOGRAPHY = {
  fonts: {
    body: "var(--font-inter), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: "var(--font-telma), 'Telma', cursive, serif",
  },
  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  scale: {
    display: { size: "32px", lineHeight: "38px", weight: "700", font: "display" },
    h1: { size: "28px", lineHeight: "34px", weight: "700", font: "display" },
    h2: { size: "24px", lineHeight: "30px", weight: "700", font: "display" },
    h3: { size: "20px", lineHeight: "26px", weight: "700", font: "body" },
    bodyLarge: { size: "17px", lineHeight: "25px", weight: "400", font: "body" },
    body: { size: "16px", lineHeight: "24px", weight: "400", font: "body" },
    bodyMedium: { size: "15px", lineHeight: "22px", weight: "500", font: "body" },
    caption: { size: "13px", lineHeight: "18px", weight: "400", font: "body" },
    price: { size: "18px", lineHeight: "22px", weight: "700", font: "body" },
    oldPrice: { size: "14px", lineHeight: "18px", weight: "400", font: "body" },
    button: { size: "15px", lineHeight: "20px", weight: "600", font: "body" },
    input: { size: "16px", lineHeight: "24px", weight: "400", font: "body" },
    navigation: { size: "13px", lineHeight: "18px", weight: "600", font: "body" },
  },
} as const;

export const DEARR_SHADOWS = {
  card: "0 2px 12px rgba(32, 33, 36, 0.06)",
  modal: "0 8px 30px rgba(32, 33, 36, 0.12)",
} as const;

export const DEARR_BUTTON_FOUNDATION = {
  height: "48px",
  radius: "12px",
  fontFamily: "var(--font-inter)",
  fontSize: "15px",
  fontWeight: "600",
  primary: {
    background: "#A2CB8B",
    text: "#202124",
  },
} as const;

export const DEARR_INPUT_FOUNDATION = {
  height: "48px",
  radius: "12px",
  border: "1px solid #D9D9D9",
  focusRing: "2px solid #A2CB8B",
  fontFamily: "var(--font-inter)",
  fontSize: "16px",
} as const;
