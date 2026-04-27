import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

const icons = {
  success: <CheckCircle className="w-4 h-4 text-neon-green shrink-0" />,
  error: <XCircle className="w-4 h-4 text-neon-pink shrink-0" />,
  info: <Info className="w-4 h-4 text-neon-blue shrink-0" />,
};

const bgColors = {
  success: 'bg-neon-green/10 border-neon-green/25',
  error: 'bg-neon-pink/10 border-neon-pink/25',
  info: 'bg-neon-blue/10 border-neon-blue/25',
};

export function Toast({
  message,
  type = 'info',
  isVisible,
  onClose,
  duration = 2500,
}: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed top-4 left-4 right-4 z-50 flex justify-center pointer-events-none"
        >
          <div
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border backdrop-blur-xl text-sm font-medium text-white shadow-2xl max-w-sm w-full ${bgColors[type]}`}
          >
            {icons[type]}
            <span className="flex-1">{message}</span>
            <button
              onClick={onClose}
              className="text-white/50 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
