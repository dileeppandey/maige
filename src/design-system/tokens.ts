// Design system tokens
// CSS variables and semantic color classes are defined in the Tailwind config
// This file is reserved for any runtime token exports or utilities

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
} as const

export const BORDER_RADIUS = {
  sm: '4px',
  md: '6px',
  lg: '8px',
} as const

export const TRANSITIONS = {
  fast: 'transition-all duration-150',
  base: 'transition-all duration-200',
  slow: 'transition-all duration-300',
} as const
