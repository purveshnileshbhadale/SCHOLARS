import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "../lib/utils";
import { daysLeft } from "../lib/deadlines";

/** Countdown pill for a deadline date ("3 days left" / "deadline passed"). */
export function DeadlineChip({ date, className }: { date?: string | null; className?: string }) {
  const days = daysLeft(date);
  if (days === null) return null;
  let cls: string;
  let label: string;
  if (days < 0) {
    cls = "border-slate-200 bg-slate-100 text-slate-500";
    label = "deadline passed";
  } else if (days === 0) {
    cls = "border-rose-300 bg-rose-50 text-rose-700";
    label = "deadline today";
  } else if (days <= 7) {
    cls = "border-rose-300 bg-rose-50 text-rose-700";
    label = `${days} day${days === 1 ? "" : "s"} left`;
  } else if (days <= 30) {
    cls = "border-amber-200 bg-amber-50 text-amber-700";
    label = `${days} days left`;
  } else {
    cls = "border-emerald-200 bg-emerald-50 text-emerald-700";
    label = `${days} days left`;
  }
  return (
    <span className={cx("inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold", cls, className)}>
      {label}
    </span>
  );
}

export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <div
      id={id}
      className={cx(
        "rounded-2xl border border-slate-200/70 bg-white/85 p-5 glow-soft backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "wa" }) {
  const styles = {
    primary:
      "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_12px_26px_-12px_rgba(16,185,129,0.75)] hover:from-emerald-500 hover:to-teal-500 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-12px_rgba(16,185,129,0.85)] active:translate-y-0",
    ghost:
      "border border-slate-300/70 bg-white/80 text-slate-800 backdrop-blur hover:border-emerald-500 hover:text-emerald-700 hover:shadow-[0_12px_26px_-16px_rgba(16,185,129,0.7)]",
    danger:
      "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-[0_12px_26px_-12px_rgba(225,29,72,0.7)] hover:from-rose-500 hover:to-red-500 hover:-translate-y-0.5",
    wa: "bg-[#25D366] text-white shadow-[0_12px_26px_-12px_rgba(37,211,102,0.8)] hover:bg-[#1eae57] hover:-translate-y-0.5",
  }[variant];
  return (
    <button
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="font-display text-sm font-semibold text-slate-800">{label}</span>
      {hint ? <span className="ml-2 text-xs text-slate-500">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-300/80 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/80";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputCls, "min-h-24", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, props.className)} />;
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-block size-5 animate-spin rounded-full border-2 border-emerald-200 border-r-cyan-400 border-t-emerald-600",
        className,
      )}
      aria-label="Loading"
    />
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div className="fade-up">
        <div className="mb-2.5 h-1 w-14 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400" />
        <h1 className="gradient-text text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <Card className="border-dashed border-slate-300/80 bg-white/60 py-12 text-center">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100 shadow-[0_14px_34px_-16px_rgba(16,185,129,0.7)]">
        <svg viewBox="0 0 24 24" className="size-7 text-emerald-600" fill="currentColor" aria-hidden>
          <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      {body ? <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{body}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Card>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 to-orange-50/60 px-4 py-3 text-sm text-rose-800 shadow-sm">
      {children}
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-[0_20px_46px_-18px_rgba(15,23,42,0.8)] ring-1 ring-white/10 md:bottom-8">
      {message}
    </div>
  );
}
