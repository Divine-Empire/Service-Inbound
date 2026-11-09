/** @type {import('tailwindcss').Config} */
// Divine design tokens, shared with Engineer-Dashboard / Lead-To-Order / OTP_Supabase.
// The ui kit (src/components/ui) uses the semantic names below
// (bg-card, text-muted-foreground, border-input, bg-primary ...).
// indigo / violet / sky / blue / slate / gray are REMAPPED onto the brand so the
// existing pages follow the new colours without per-file edits.
const brand = {
  50: '#f0f6fc', 100: '#e1edf9', 200: '#c5ddf3', 300: '#9cc4ea', 400: '#66a5dd',
  500: '#3b8ad0', 600: '#2274b8', 700: '#1b5e98', 800: '#174d7c', 900: '#153f66', 950: '#0d2740',
};
const neutral = {
  50: '#f4f7fa', 100: '#eaf0f5', 200: '#dbe3ec', 300: '#c3cedb', 400: '#8a9bb0',
  500: '#64748b', 600: '#4b5a6e', 700: '#3a4859', 800: '#263241', 900: '#172030', 950: '#0c1320',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand,
        indigo: brand,
        violet: brand,
        sky: brand,
        blue: brand,
        slate: neutral,
        gray: neutral,
        'brand-lime': 'hsl(var(--brand-lime))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        success: { DEFAULT: 'hsl(var(--success))', foreground: 'hsl(var(--success-foreground))' },
        warning: { DEFAULT: 'hsl(var(--warning))', foreground: 'hsl(var(--warning-foreground))' },
        info: { DEFAULT: 'hsl(var(--info))', foreground: 'hsl(var(--info-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
