import type { ButtonHTMLAttributes, Ref } from "react";
import type { LucideIcon } from "lucide-react";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label" | "title"> & {
  icon: LucideIcon;
  label: string;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

export function IconAction({ icon: Icon, label, loading = false, className = "", disabled, type = "button", ref, ...props }: Props) {
  return <button ref={ref} type={type} aria-label={label} title={label} disabled={disabled || loading}
    className={`inline-grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-white text-ink transition hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}>
    <Icon size={20} className={loading ? "animate-spin" : ""} aria-hidden="true" />
  </button>;
}
