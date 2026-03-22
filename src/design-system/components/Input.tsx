import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  helperText,
  error,
  leftIcon,
  rightIcon,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full h-8 px-3 text-sm
            bg-surface-input border rounded-md
            text-text-primary placeholder:text-text-faint
            transition-colors
            focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/60
            disabled:opacity-40 disabled:cursor-not-allowed
            ${error ? 'border-red-500' : 'border-border-base'}
            ${leftIcon ? 'pl-8' : ''}
            ${rightIcon ? 'pr-8' : ''}
            ${className}
          `}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
            {rightIcon}
          </span>
        )}
      </div>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      {!error && helperText && <p className="text-[11px] text-text-muted">{helperText}</p>}
    </div>
  )
})
Input.displayName = 'Input'
