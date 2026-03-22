/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Brand accent - supports opacity modifiers (bg-accent/15, text-accent/50)
                accent: {
                    DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
                    hover: 'rgb(var(--accent-hover) / <alpha-value>)',
                },
                // Semantic surfaces - auto-switches between light/dark themes
                surface: {
                    bg:     'rgb(var(--surface-bg) / <alpha-value>)',
                    panel:  'rgb(var(--surface-panel) / <alpha-value>)',
                    raised: 'rgb(var(--surface-raised) / <alpha-value>)',
                    card:   'rgb(var(--surface-card) / <alpha-value>)',
                    input:  'rgb(var(--surface-input) / <alpha-value>)',
                    hover:  'rgb(var(--surface-hover) / <alpha-value>)',
                },
                // Semantic borders
                border: {
                    subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
                    base:   'rgb(var(--border-base) / <alpha-value>)',
                    strong: 'rgb(var(--border-strong) / <alpha-value>)',
                },
                // Semantic text
                text: {
                    primary:   'rgb(var(--text-primary) / <alpha-value>)',
                    secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
                    muted:     'rgb(var(--text-muted) / <alpha-value>)',
                    faint:     'rgb(var(--text-faint) / <alpha-value>)',
                },
            },
        },
    },
    plugins: [],
}
