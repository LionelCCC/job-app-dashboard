/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette
        midnight: {
          DEFAULT: "#001F3F",
          card:    "#002850",
          hover:   "#003570",
          deep:    "#00162D",
        },
        praxeti: "#F6F7ED",
        spring: {
          DEFAULT: "#DBE64C",
          hover:   "#C8D440",
          light:   "#EBF07A",
        },
        mantis:    "#74C365",
        bookgreen: "#00804D",
        nuit: {
          DEFAULT: "#1E488F",
          light:   "#2A5AAB",
        },
        // Keep extended slate for backward compat
        slate: {
          750: "#1e2a3a",
          850: "#172033",
          950: "#0a0f1e",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "spin-slow":  "spin 3s linear infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
