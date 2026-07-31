/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'class' (not the default 'media') so app.json's userInterfaceStyle:
  // "light" can force light mode without NativeWind's "manually set color
  // scheme" error — no dark theme exists (light-only per the design system).
  darkMode: 'class',
  theme: {
    extend: {
      // Lotea Design System v1.0 — flat, semantic tokens (not a 50-900 scale;
      // the design system defines discrete named colors, not a ramp). Real
      // hex values mirrored in src/shared/theme/colors.ts for native/SVG use.
      colors: {
        primary: '#C74B28',
        'primary-tint': '#F2E5DF',
        'primary-dark': '#9A3A1F',
        ink: '#121010',
        muted: '#6B6560',
        placeholder: '#9A948F',
        success: '#278A49',
        'success-tint': '#E0F4E9',
        'success-strong': '#1A7A3A',
        'success-glow': '#4FC87A',
        warning: '#D97706',
        'warning-tint': '#FEF3CD',
        'warning-strong': '#92610A',
        danger: '#DC2626',
        'danger-tint': '#FEE2E2',
        'danger-soft-tint': '#FEF2EE',
        'danger-strong': '#9A2D0F',
        bg: '#F7F6F3',
        surface: '#FFFFFF',
        divider: '#EDEAE4',
        'divider-soft': '#F0EDE7',
        'divider-faint': '#F5F2ED',
      },
    },
  },
  plugins: [],
};
