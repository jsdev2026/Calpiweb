import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = ({ label, className, id, ...props }: InputProps) => (
  <div className={cn('flex flex-col space-y-1.5', className)}>
    {label && (
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
    )}
    <input
      id={id}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
      {...props}
    />
  </div>
);
