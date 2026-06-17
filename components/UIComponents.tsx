import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}) => {
  const variants = {
    primary: 'bg-primary hover:bg-primaryDark text-black shadow-[0_0_15px_rgba(230,224,212,0.3)] hover:shadow-[0_0_25px_rgba(230,224,212,0.6)] border border-primary/50',
    secondary: 'bg-surfaceHighlight hover:bg-zinc-700 text-white border border-white/5 shadow-lg',
    outline: 'border border-zinc-700 hover:border-primary text-zinc-300 hover:text-white bg-transparent hover:shadow-[0_0_15px_rgba(230,224,212,0.2)] hover:bg-primary/5',
    ghost: 'hover:bg-white/5 text-zinc-300 hover:text-white',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={cn(
        'rounded-lg font-semibold transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
};

// Input
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ className, label, error, ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-zinc-400 mb-1.5">{label}</label>}
      <input
        className={cn(
          'w-full px-4 py-2.5 rounded-lg bg-surface/80 backdrop-blur-md border border-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-300 placeholder:text-zinc-600 hover:border-zinc-700 focus:shadow-[0_0_15px_rgba(230,224,212,0.15)]',
          error && 'border-red-500 focus:ring-red-500/25 focus:shadow-[0_0_15px_rgba(239,68,68,0.15)]',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500 animate-fade-in">{error}</p>}
    </div>
  );
};

// Badge
export const Badge: React.FC<{ children: React.ReactNode; color?: string; className?: string }> = ({
  children,
  color = 'bg-zinc-800 border border-white/10 text-zinc-200',
  className
}) => {
  return (
    <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide shadow-sm', color, className)}>
      {children}
    </span>
  );
};

// Card
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => {
  return (
    <div
      className={cn("glass rounded-xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-black/60 hover:border-white/20", className)}
      {...props}
    >
      {children}
    </div>
  );
};
