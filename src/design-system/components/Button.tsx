import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  iconOnly?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent hover:bg-accent-hover text-black font-semibold',
  secondary: 'bg-surface-card border border-border-base text-text-secondary hover:bg-surface-hover',
  ghost: 'bg-transparent text-text-secondary hover:bg-surface-hover',
  danger: 'bg-red-600 hover:bg-red-500 text-white font-medium',
  link: 'bg-transparent text-accent hover:text-accent-hover underline-offset-4 hover:underline p-0',
}

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'h-6 px-2 text-[11px] rounded gap-1',
  sm: 'h-7 px-2.5 text-xs rounded gap-1.5',
  md: 'h-8 px-3 text-sm rounded-md gap-2',
  lg: 'h-9 px-4 text-sm rounded-md gap-2',
}

const iconOnlySizeClasses: Record<ButtonSize, string> = {
  xs: 'h-6 w-6 rounded p-0',
  sm: 'h-7 w-7 rounded p-0',
  md: 'h-8 w-8 rounded-md p-0',
  lg: 'h-9 w-9 rounded-md p-0',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'secondary',
  size = 'md',
  loading = false,
  iconOnly = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}, ref) => {
  const isDisabled = disabled || loading

  const baseClasses = 'inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40 disabled:cursor-not-allowed select-none'
  const variantClass = variantClasses[variant]
  const sizeClass = iconOnly ? iconOnlySizeClasses[size] : sizeClasses[size]

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={`${baseClasses} ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 size={12} className="animate-spin" />
      ) : leftIcon ? (
        <span className="shrink-0">{leftIcon}</span>
      ) : null}
      {children}
      {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  )
})
Button.displayName = 'Button'
