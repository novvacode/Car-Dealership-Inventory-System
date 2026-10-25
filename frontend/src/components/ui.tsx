import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent-500 text-white shadow-sm hover:bg-accent-600 active:bg-accent-700",
  secondary: "border border-stone-300 bg-white text-ink-900 shadow-xs hover:border-stone-400 hover:bg-stone-50",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
  ghost: "text-ink-700 hover:bg-stone-200/60",
};

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition
        disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className = "h-5 w-5", label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className="inline-flex items-center gap-2">
      <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      {label && <span className="text-sm text-stone-500">{label}</span>}
    </span>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex justify-center py-20 text-accent-500">
      <Spinner className="h-7 w-7" label={label} />
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-16 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M3 13l2-6a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 7l2 6v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
          <path d="M3 13h18M7 16h.01M17 16h.01" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-base font-bold text-ink-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-center">
      <p className="flex-1">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="self-start sm:self-auto">
          Try again
        </Button>
      )}
    </div>
  );
}

export function StockBadge({ quantity }: { quantity: number }) {
  const [tone, text] =
    quantity === 0
      ? ["bg-red-50 text-red-700 ring-red-200", "Out of stock"]
      : quantity <= 2
        ? ["bg-amber-50 text-amber-800 ring-amber-200", `Only ${quantity} left`]
        : ["bg-emerald-50 text-emerald-700 ring-emerald-200", `${quantity} in stock`];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${tone}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}
