import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface GlowButtonProps {
  children: ReactNode;
  onClick?: () => void;
  onPointerDown?: () => void;
  onTouchStart?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  id?: string;
  fullWidth?: boolean;
}

export function GlowButton({
  children,
  onClick,
  onPointerDown,
  onTouchStart,
  className,
  variant = 'primary',
  size = 'md',
  disabled = false,
  id,
  fullWidth = false,
}: GlowButtonProps) {
  const baseStyles = 'relative font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2';

  const variants = {
    primary: 'btn-neon-gradient text-white shadow-lg shadow-neon-blue/20 hover:shadow-neon-blue/40 active:scale-[0.97]',
    secondary: 'glass glow-border text-neon-blue hover:bg-glass-bg-hover active:scale-[0.97]',
    ghost: 'text-gray-400 hover:text-white hover:bg-white/5 active:scale-[0.97]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <motion.button
      id={id}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onTouchStart={onTouchStart}
      disabled={disabled}
      className={clsx(
        baseStyles,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        className
      )}
    >
      {children}
    </motion.button>
  );
}
