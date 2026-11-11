interface ScoreMeterProps {
  score: number
  verdict?: 'strong' | 'moderate' | 'weak'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export function ScoreMeter({
  score,
  verdict,
  size = 'md',
  showLabel = true,
  className = '',
}: ScoreMeterProps) {
  const normalizedScore = Math.min(100, Math.max(0, Math.round(score)))

  const config =
    normalizedScore >= 75
      ? {
          stroke: '#10b981', // emerald-500
          track: '#e2e8f0',
          text: 'text-emerald-700',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          label: 'Strong match',
        }
      : normalizedScore >= 50
        ? {
            stroke: '#f59e0b', // amber-500
            track: '#e2e8f0',
            text: 'text-amber-800',
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            label: 'Moderate match',
          }
        : {
            stroke: '#ef4444', // red-500
            track: '#e2e8f0',
            text: 'text-rose-700',
            bg: 'bg-rose-50',
            border: 'border-rose-200',
            label: 'Weak match',
          }

  const dimensions = {
    sm: { size: 64, strokeWidth: 6, fontSize: 'text-lg', labelSize: 'text-[10px]' },
    md: { size: 96, strokeWidth: 8, fontSize: 'text-2xl', labelSize: 'text-xs' },
    lg: { size: 128, strokeWidth: 10, fontSize: 'text-4xl', labelSize: 'text-sm' },
  }[size]

  const radius = (dimensions.size - dimensions.strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference

  return (
    <div
      role="meter"
      aria-label="Job Fit Score"
      aria-valuenow={normalizedScore}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`inline-flex flex-col items-center justify-center ${className}`}
    >
      <div className="relative inline-flex items-center justify-center">
        <svg
          width={dimensions.size}
          height={dimensions.size}
          viewBox={`0 0 ${dimensions.size} ${dimensions.size}`}
          className="-rotate-90 transform"
        >
          {/* Background circle */}
          <circle
            cx={dimensions.size / 2}
            cy={dimensions.size / 2}
            r={radius}
            stroke={config.track}
            strokeWidth={dimensions.strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={dimensions.size / 2}
            cy={dimensions.size / 2}
            r={radius}
            stroke={config.stroke}
            strokeWidth={dimensions.strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center score display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold tracking-tight text-slate-900 ${dimensions.fontSize}`}>
            {normalizedScore}
            <span className="text-xs font-normal text-slate-400">%</span>
          </span>
        </div>
      </div>

      {showLabel && (
        <span
          className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold capitalize ${config.bg} ${config.text} ${config.border} ${dimensions.labelSize}`}
        >
          {verdict ? `${verdict} match` : config.label}
        </span>
      )}
    </div>
  )
}
