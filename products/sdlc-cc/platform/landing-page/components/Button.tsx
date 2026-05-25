import { memo } from 'react';
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

export const Button: React.FC<ButtonProps> = memo(({
  href,
  variant = 'primary',
  size = 'md',
  children,
  icon: Icon,
  onClick,
  className = '',
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary';

  const variantClasses = {
    primary: 'button-primary text-white',
    secondary: 'button-secondary',
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
        whileHover={{ y: -1 }}
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
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
    >
      {content}
    </motion.button>
  );
});

Button.displayName = 'Button';
