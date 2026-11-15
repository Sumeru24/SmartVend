/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        ink: {
          50: "#f6f7f4",
          100: "#e7e9e2",
          200: "#cfd4c8",
          300: "#aab3a0",
          400: "#7f8d74",
          500: "#5f6f56",
          600: "#4a5743",
          700: "#3c4637",
          800: "#323a2e",
          900: "#22281f",
          950: "#10140e",
        },
        lime: {
          50: "#f7fee7",
          100: "#ecfccb",
          200: "#d9f99d",
          300: "#bef264",
          400: "#a3e635",
          500: "#84cc16",
          600: "#65a30d",
          700: "#4d7c0f",
          800: "#3f6212",
          900: "#365314",
          950: "#1a2e05",
        },
        volt: {
          DEFAULT: "#c9f56a",
          soft: "#e8fbc2",
          deep: "#a8dc3f",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,20,14,0.04), 0 12px 32px -20px rgba(16,20,14,0.18)",
        lift: "0 24px 70px -30px rgba(16,20,14,0.35)",
        glow: "0 0 0 1px rgba(201,245,106,0.25), 0 24px 80px -20px rgba(201,245,106,0.25)",
      },
      animation: {
        "fade-in": "fadeIn 0.35s ease-out both",
        "slide-up": "slideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-soft": "pulseSoft 2.8s ease-in-out infinite",
        shimmer: "shimmer 1.6s linear infinite",
        float: "float 7s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        slideUp: {
          from: { opacity: 0, transform: "translateY(16px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.55 },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
    },
  },
  plugins: [],
};
