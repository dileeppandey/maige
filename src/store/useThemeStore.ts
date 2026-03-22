import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'

interface ThemeStore {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const getSystemTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: getSystemTheme(),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'maige-theme' }
  )
)
