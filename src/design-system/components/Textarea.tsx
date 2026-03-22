import { forwardRef } from 'react'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  helperText?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  helperText,
  error,
  className = '',
  id,
  ...props
}, ref) => {
  const textareaId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={textareaId} className="text-xs font-medium text-text-secondary">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        className={`
          w-full px-3 py-2 text-sm
          bg-surface-input border rounded-md
          text-text-primary placeholder:text-text-faint
          resize-y min-h-[80px]
          transition-colors
          focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/60
          disabled:opacity-40 disabled:cursor-not-allowed
          ${error ? 'border-red-500' : 'border-border-base'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      {!error && helperText && <p className="text-[11px] text-text-muted">{helperText}</p>}
    </div>
  )
})
Textarea.displayName = 'Textarea'
