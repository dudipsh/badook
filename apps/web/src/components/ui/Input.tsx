import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = ({ label, error, className = '', ...props }: InputProps) => {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-base-content">{label}</label>}
      <input
        className={`w-full px-3 py-2 border border-base-300 rounded-lg text-sm bg-base-100 text-base-content focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent ${error ? 'border-error' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
