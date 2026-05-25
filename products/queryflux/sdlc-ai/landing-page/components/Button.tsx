import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface ButtonProps {
  href?: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  icon?: LucideIcon;
  onClick?: () => void;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  href,
  variant = 'primary',
  size = 'md',
  children,
  icon: Icon,
  onClick,
  className = '',
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-lg tracking-wide transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sdlc-accent';

  const variantClasses = {
    primary: 'bg-gradient-to-r from-sdlc-blue via-sky-400 to-sdlc-accent text-white shadow-[0_12px_28px_rgba(24,208,255,0.26)]',
    secondary: 'border border-sdlc-blue/60 bg-sky-900/20 text-sdlc-light hover:border-sdlc-accent/80',
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  const content = (
    <>
      {children}
      {Icon && <Icon className="ml-2 h-5 w-5" />}
    </>
  );

  if (href) {
    return (
      <motion.a
        href={href}
        className={classes}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      className={classes}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      {content}
    </motion.button>
  );
};
