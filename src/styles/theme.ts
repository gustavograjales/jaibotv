/**
 * JAIBO Theme Tokens
 *
 * Los colores y valores con `var(--...)` consumen las CSS variables
 * definidas en `tokens.css`. Esa es la fuente única de verdad.
 *
 * Los valores numéricos (spacing, radius en número) están duplicados
 * porque a veces se necesitan en cálculos JS (animaciones, layout).
 */

export const theme = {
  colors: {
    // Base
    bg: "var(--color-bg)",
    primary: "var(--color-primary)",
    accent: "var(--color-accent)",
    ui: "var(--color-ui)",
    text: "var(--color-text)",

    // Semánticos
    surface: "var(--color-surface)",
    surfaceElevated: "var(--color-surface-elevated)",
    border: "var(--color-border)",
    borderStrong: "var(--color-border-strong)",

    textPrimary: "var(--color-text-primary)",
    textMuted: "var(--color-text-muted)",
    textSubtle: "var(--color-text-subtle)",

    // Estados
    success: "var(--color-success)",
    error: "var(--color-error)",
    warning: "var(--color-warning)",

    // Interactivos
    focusRing: "var(--color-focus-ring)",
    hoverOverlay: "var(--color-hover-overlay)",
  },

  fonts: {
    display: "var(--font-display)",
    body: "var(--font-body)",
  },

  fontSize: {
    xs: "var(--text-xs)",
    sm: "var(--text-sm)",
    base: "var(--text-base)",
    lg: "var(--text-lg)",
    xl: "var(--text-xl)",
    "2xl": "var(--text-2xl)",
    "3xl": "var(--text-3xl)",
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    "2xl": 48,
    "3xl": 64,
  },

  radius: {
    sm: 6,
    md: 12,
    lg: 20,
    full: 9999,
  },

  shadow: {
    card: "var(--shadow-card)",
    modal: "var(--shadow-modal)",
    glowPrimary: "var(--glow-primary)",
    glowAccent: "var(--glow-accent)",
  },

  motion: {
    durationFast: "var(--duration-fast)",
    durationBase: "var(--duration-base)",
    durationSlow: "var(--duration-slow)",
    easeOut: "var(--ease-out)",
    easeInOut: "var(--ease-in-out)",
  },
} as const;

export type Theme = typeof theme;
