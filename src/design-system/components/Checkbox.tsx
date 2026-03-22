import { Check } from 'lucide-react'
import { forwardRef } from 'react'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  className?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = '',
}, ref) => {
  return (
    <label className={`flex items-start gap-2.5 cursor-pointer group ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className}`}>
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
          aria-checked={checked}
        />
        <div className={`
          w-4 h-4 rounded border transition-colors
          ${checked
            ? 'bg-accent border-accent'
            : 'bg-surface-input border-border-base group-hover:border-accent/60'
          }
        `}>
          {checked && (
            <Check size={11} className="text-black absolute inset-0 m-auto" strokeWidth={3} />
          )}
        </div>
      </div>
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && <span className="text-sm text-text-primary leading-tight">{label}</span>}
          {description && <span className="text-xs text-text-muted">{description}</span>}
        </div>
      )}
    </label>
  )
})
Checkbox.displayName = 'Checkbox'
