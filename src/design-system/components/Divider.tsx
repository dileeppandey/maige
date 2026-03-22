interface DividerProps {
  orientation?: 'horizontal' | 'vertical'
  className?: string
  label?: string
}

export function Divider({ orientation = 'horizontal', className = '', label }: DividerProps) {
  if (orientation === 'vertical') {
    return <div className={`w-px self-stretch bg-border-subtle ${className}`} />
  }

  if (label) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex-1 h-px bg-border-subtle" />
        <span className="text-[11px] text-text-faint uppercase tracking-wide font-medium">{label}</span>
        <div className="flex-1 h-px bg-border-subtle" />
      </div>
    )
  }

  return <div className={`h-px w-full bg-border-subtle ${className}`} />
}
