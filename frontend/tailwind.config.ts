import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic Theme Tokens (Auto-adapts between Light and Dark via CSS variables)
        "surface-canvas": "var(--surface-canvas)",
        "surface-card": "var(--surface-card)",
        "surface-subtle": "var(--surface-subtle)",
        "surface-elevated": "var(--surface-elevated)",
        "border-default": "var(--border-default)",
        "border-subtle": "var(--border-subtle)",

        // Warm Editorial & Executive Professional Palette (Zero neon / purple AI-slop)
        surface: {
          50: "#FAF9F6",  // Warm off-white paper canvas
          100: "#F5F3EF", // Subtle panel background
          200: "#EAE6DF", // Divider & card border
          300: "#DCD6CB", // Stronger boundary line
          800: "#262422", // Deep charcoal card surface
          900: "#1A1918", // Dark executive base
        },
        ink: {
          primary: "#1C1917",   // High-readability rich charcoal
          secondary: "#57534E", // Crisp metadata & subtext
          muted: "#8C857B",     // Dim helper captions
          inverse: "#FDFCFB",   // Text on dark buttons/chips
        },
        brand: {
          DEFAULT: "#78350F", // Deep warm amber / leather
          light: "#B45309",
          dark: "#451A03",
        },
        grounded: {
          surface: "#F0FDF4", // Subtle sage green for verified grounding
          border: "#BBF7D0",
          text: "#15803D",
        },
        accent: {
          highlight: "#FDE68A", // Amber highlighter for PDF bounding boxes
          badge: "#FEF3C7",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
