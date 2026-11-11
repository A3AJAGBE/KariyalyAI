import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface CopyButtonProps {
  text: string
  label?: string
  copiedLabel?: string
  className?: string
  variant?: 'outline' | 'ghost' | 'solid'
  size?: 'sm' | 'md'
}

export function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied!',
  className = '',
  variant = 'outline',
  size = 'md',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const baseStyle =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 select-none disabled:opacity-50 cursor-pointer'

  const sizeStyle =
    size === 'sm'
      ? 'text-xs px-2.5 py-1.5 gap-1.5'
      : 'text-sm px-3.5 py-2 gap-2'

  const variantStyle = {
    outline:
      'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-xs active:bg-slate-100',
    ghost:
      'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 active:bg-slate-200/70',
    solid:
      'bg-blue-600 text-white hover:bg-blue-700 shadow-sm active:bg-blue-800',
  }[variant]

  const copiedStyle = copied
    ? '!border-emerald-300 !bg-emerald-50 !text-emerald-700'
    : ''

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? copiedLabel : label}
      title={label}
      className={`${baseStyle} ${sizeStyle} ${variantStyle} ${copiedStyle} ${className}`}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-600 transition-transform duration-200 scale-110" />
      ) : (
        <Copy className="h-4 w-4 text-current transition-transform duration-200" />
      )}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  )
}
