/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    primary: 'var(--color-brand-primary)',
                    accent: 'var(--color-brand-accent)',
                    light: 'var(--color-brand-light)',
                    secondary: '#1f2937', // Gray-800 equivalent
                }
            }
        },
    },
    plugins: [],
}
