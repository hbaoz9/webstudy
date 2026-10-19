import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'dark';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-emerald text-white hover:bg-emerald/90',
  secondary: 'bg-amber text-ink hover:bg-amber/90',
  outline: 'border border-line bg-white text-ink hover:bg-canvas',
  dark: 'bg-ink text-white hover:bg-ink/90',
};

export function Button({ children, variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
