import type { ReactNode } from 'react'

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'ai'
  | 'strong'
  | 'moderate'
  | 'weak'
  | 'saved'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
  icon?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Badge({
  children,
  variant = 'default',
  className = '',
  icon,
  size = 'md',
}: BadgeProps) {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size]

  const variantClasses: Record<BadgeVariant, string> = {
    default: 'bg-slate-100 text-slate-700 border-slate-200/80',
    neutral: 'bg-slate-50 text-slate-600 border-slate-200',
    primary: 'bg-blue-50 text-blue-700 border-blue-200/70',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
    warning: 'bg-amber-50 text-amber-800 border-amber-200/80',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/70',
    ai: 'bg-indigo-50 text-indigo-700 border-indigo-200/80 font-medium tracking-wide',
    strong: 'bg-emerald-100/80 text-emerald-800 border-emerald-300 font-semibold',
    moderate: 'bg-amber-100/80 text-amber-900 border-amber-300 font-semibold',
    weak: 'bg-rose-100/80 text-rose-800 border-rose-300 font-semibold',
    saved: 'bg-slate-100 text-slate-700 border-slate-300',
    applied: 'bg-blue-50 text-blue-700 border-blue-200',
    interview: 'bg-purple-50 text-purple-700 border-purple-200',
    offer: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium shadow-xs transition-colors ${sizeClasses} ${variantClasses[variant]} ${className}`}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  )
}
