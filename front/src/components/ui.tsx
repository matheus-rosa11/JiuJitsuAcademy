"use client";

import { LoaderCircle, TriangleAlert, X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { initials } from "@/lib/format";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm",
  secondary: "bg-white text-zinc-800 ring-1 ring-zinc-200 hover:bg-zinc-50 shadow-sm",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  danger: "bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50",
  success: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm",
};

/** Also used to style <Link>s as buttons. */
export function buttonClass({ variant = "primary", size = "md", className }: { variant?: ButtonVariant; size?: "sm" | "md" | "lg"; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
    size === "sm" && "h-9 px-3 text-sm",
    size === "md" && "h-11 px-4 text-sm",
    size === "lg" && "h-14 px-6 text-base",
    buttonVariants[variant],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  return (
    <button
      className={buttonClass({ variant, size, className })}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl bg-white ring-1 ring-zinc-200/70 shadow-sm", className)}>{children}</div>;
}

export function CardHeader({ title, action, icon }: { title: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}

const badgeTones = {
  zinc: "bg-zinc-100 text-zinc-700",
  green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-1 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
};

export function Badge({ tone = "zinc", children, className }: { tone?: keyof typeof badgeTones; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

const fieldClass =
  "w-full rounded-xl border-0 bg-white px-3.5 text-sm text-zinc-900 ring-1 ring-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-50";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, "min-h-24 py-2.5", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldClass, "h-11 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

/** Use `group` when the content is a set of buttons: a <label> would forward clicks to the first one. */
export function Field({
  label,
  hint,
  children,
  className,
  group,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  group?: boolean;
}) {
  const Wrapper = group ? "div" : "label";
  return (
    <Wrapper className={cn("block space-y-1.5", className)}>
      <span className="block text-sm font-medium text-zinc-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
    </Wrapper>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-xl bg-zinc-100 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
            value === o.value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl",
          size === "md" ? "sm:max-w-lg" : "sm:max-w-2xl",
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          <button onClick={onClose} className="cursor-pointer rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-zinc-100 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
      <LoaderCircle className="size-5 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="rounded-full bg-red-50 p-3 text-red-600">
        <TriangleAlert className="size-6" />
      </div>
      <p className="text-sm text-zinc-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </Card>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="mb-1 rounded-2xl bg-zinc-100 p-3 text-zinc-500">{icon}</div>
      <p className="font-medium text-zinc-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Avatar({ name, size = "md", tone = "zinc" }: { name: string; size?: "sm" | "md" | "lg"; tone?: "zinc" | "sky" | "amber" }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "sm" && "size-8 text-xs",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-16 text-xl",
        tone === "zinc" && "bg-zinc-100 text-zinc-700",
        tone === "sky" && "bg-sky-100 text-sky-700",
        tone === "amber" && "bg-amber-100 text-amber-700",
      )}
    >
      {initials(name)}
    </div>
  );
}

export function rateTone(rate: number) {
  return rate < 60 ? "red" : rate < 75 ? "amber" : "green";
}

export function ProgressBar({ value, tone = "zinc", className }: { value: number; tone?: "zinc" | "green" | "amber" | "red"; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-zinc-100", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all",
          tone === "zinc" && "bg-zinc-900",
          tone === "green" && "bg-emerald-500",
          tone === "amber" && "bg-amber-500",
          tone === "red" && "bg-red-500",
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
