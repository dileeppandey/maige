import { Loader2 } from 'lucide-react'

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg'

interface SpinnerProps {
  size?: SpinnerSize
  className?: string
  /** If true, wraps in a full-height centered container */
  fullHeight?: boolean
  label?: string
}

const sizeMap: Record<SpinnerSize, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 28,
}

export function Spinner({ size = 'md', className = '', fullHeight = false, label }: SpinnerProps) {
  const icon = (
    <Loader2
      size={sizeMap[size]}
      className={`animate-spin text-text-muted ${className}`}
    />
  )

  if (fullHeight) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        {icon}
        {label && <p className="text-xs text-text-muted">{label}</p>}
      </div>
    )
  }

  return icon
}
