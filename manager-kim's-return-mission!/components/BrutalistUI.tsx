
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'gold' | 'danger' | 'ghost';
  fullWidth?: boolean;
}

export const BrutalistButton: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false,
  className = '',
  ...props 
}) => {
  const baseStyles = "brutal-border font-black py-3 px-6 transform transition-all active:translate-x-1 active:translate-y-1 active:shadow-none uppercase tracking-tighter";
  const variants = {
    primary: "bg-white text-black brutalist-shadow",
    gold: "bg-[#ffd700] text-black brutalist-shadow-gold",
    danger: "bg-red-500 text-white brutalist-shadow",
    ghost: "bg-transparent text-white border-white"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const BrutalistInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => {
  return (
    <input 
      className={`brutal-border bg-white text-black p-4 font-bold brutalist-shadow outline-none focus:ring-4 ring-yellow-400 ${className}`}
      {...props}
    />
  );
};

export const BrutalistCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  return (
    <div className={`brutal-border bg-[#2a2a2a] p-6 brutalist-shadow border-white/20 ${className}`}>
      {children}
    </div>
  );
};
