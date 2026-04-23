import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = ({ label, className, id, ...props }: InputProps) => (
  <div className={cn('flex flex-col space-y-1.5', className)}>
    {label && (
      <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </label>
    )}
    <input
      id={id}
      className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition-all focus:outline-none focus:ring-1 focus:ring-blue-500"
      {...props}
    />
  </div>
);
