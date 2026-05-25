import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronRight } from 'lucide-react';
import { Card } from '../atoms/Card/Card';
import { Badge } from '../atoms/Badge/Badge';
import { Button } from '../atoms/Button/Button';

interface PricingCardProps {
  name: string;
  price: number | string;
  period: string;
  description: string;
  features: string[];
  icon: ReactNode;
  highlighted?: boolean;
  cta: string;
  onCTA?: () => void;
}

const PricingCard = ({
  name,
  price,
  period,
  description,
  features,
  icon,
  highlighted = false,
  cta,
  onCTA
}: PricingCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card
        className={`h-full p-8 flex flex-col transition-all border-2 ${
          highlighted
            ? 'border-blue-500 bg-gradient-to-br from-blue-950 to-slate-900 ring-2 ring-blue-500/20'
            : 'border-slate-700 hover:border-slate-600'
        }`}
      >
        {highlighted && (
          <Badge className="mb-4 w-fit bg-blue-600">Most Popular</Badge>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="text-blue-400 opacity-80">{icon}</div>
          <h3 className="text-2xl font-bold">{name}</h3>
        </div>

        <p className="text-slate-400 text-sm mb-6">{description}</p>

        {/* Price */}
        <div className="mb-8">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold">
              {typeof price === 'string' ? price : `$${price}`}
            </span>
            {typeof price === 'number' && (
              <span className="text-slate-400">/{period}</span>
            )}
          </div>
        </div>

        {/* Features List */}
        <ul className="mb-8 flex-1 space-y-3">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-3 text-slate-300 text-sm">
              <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        <Button
          variant={highlighted ? 'primary' : 'outline'}
          className="w-full gap-2"
          onClick={onCTA}
        >
          {cta}
          <ChevronRight className="w-4 h-4" />
        </Button>

        {typeof price === 'number' && price > 0 && (
          <p className="text-slate-500 text-xs text-center mt-4">
            Billed {period} • Cancel anytime
          </p>
        )}
      </Card>
    </motion.div>
  );
};

export default PricingCard;
