import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  glowColor?: 'blue' | 'purple';
  onClick?: () => void;
  id?: string;
}

export function GlassCard({
  children,
  className,
  glow = false,
  glowColor = 'blue',
  onClick,
  id,
}: GlassCardProps) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      onClick={onClick}
      className={clsx(
        'glass rounded-2xl p-4',
        glow && (glowColor === 'blue' ? 'glow-blue glow-border' : 'glow-purple'),
        onClick && 'cursor-pointer active:scale-[0.98] transition-transform',
        className
      )}
    >
      {children}
    </motion.div>
  );
}
