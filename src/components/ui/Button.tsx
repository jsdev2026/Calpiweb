import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'active' | 'tool';
export type ButtonSize = 'sm' | 'md' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const baseStyle =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-900/20',
  secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
  outline: 'border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
  danger: 'border border-red-300/50 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40',
  ghost: 'bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
  active: 'border border-orange-500/50 bg-orange-500/10 text-orange-600 dark:text-orange-400',
  tool: 'bg-gray-50 border border-gray-200 text-gray-600 hover:text-orange-500 hover:border-orange-500/50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  icon: 'p-2',
};

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) => (
  <button className={cn(baseStyle, variants[variant], sizes[size], className)} {...props}>
    {children}
  </button>
);
