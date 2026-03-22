import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

// ── Modal Root ────────────────────────────────────────────────────────────────
type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  size?: ModalSize
  className?: string
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm w-full',
  md: 'max-w-md w-full',
  lg: 'max-w-lg w-full',
  xl: 'max-w-2xl w-full',
  full: 'max-w-5xl w-full',
}

export function Modal({ isOpen, onClose, children, size = 'md', className = '' }: ModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Modal panel */}
      <div className={`
        relative z-10 flex flex-col
        bg-surface-card border border-border-base rounded-xl shadow-2xl
        max-h-[90vh]
        ${sizeClasses[size]}
        ${className}
      `}>
        {children}
      </div>
    </div>
  )
}

// ── Modal Header ──────────────────────────────────────────────────────────────
interface ModalHeaderProps {
  children: ReactNode
  onClose?: () => void
  icon?: ReactNode
  className?: string
}

export function ModalHeader({ children, onClose, icon, className = '' }: ModalHeaderProps) {
  return (
    <div className={`flex items-center gap-3 px-6 py-4 border-b border-border-subtle shrink-0 ${className}`}>
      {icon && <span className="text-accent shrink-0">{icon}</span>}
      <h2 className="flex-1 text-base font-semibold text-text-primary">{children}</h2>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}

// ── Modal Body ────────────────────────────────────────────────────────────────
interface ModalBodyProps {
  children: ReactNode
  className?: string
  scrollable?: boolean
  padding?: boolean
}

export function ModalBody({ children, className = '', scrollable = true, padding = true }: ModalBodyProps) {
  return (
    <div className={`
      flex-1 min-h-0
      ${scrollable ? 'overflow-y-auto' : ''}
      ${padding ? 'px-6 py-5' : ''}
      ${className}
    `}>
      {children}
    </div>
  )
}

// ── Modal Footer ──────────────────────────────────────────────────────────────
interface ModalFooterProps {
  children: ReactNode
  className?: string
  align?: 'left' | 'right' | 'between'
}

export function ModalFooter({ children, className = '', align = 'right' }: ModalFooterProps) {
  const alignClass = { left: 'justify-start', right: 'justify-end', between: 'justify-between' }[align]
  return (
    <div className={`flex items-center gap-3 px-6 py-4 border-t border-border-subtle shrink-0 ${alignClass} ${className}`}>
      {children}
    </div>
  )
}
