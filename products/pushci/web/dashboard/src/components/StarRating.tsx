import { useState } from 'react';

interface Props {
  rating: number;
  onChange?: (rating: number) => void;
  size?: 'sm' | 'md';
  showValue?: boolean;
  count?: number;
}

export default function StarRating({ rating, onChange, size = 'sm', showValue, count }: Props) {
  const [hover, setHover] = useState(0);
  const interactive = !!onChange;
  const starSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(star => {
        const filled = star <= (hover || Math.round(rating));
        return (
          <button key={star} type="button" disabled={!interactive}
            onMouseEnter={() => interactive && setHover(star)}
            onMouseLeave={() => interactive && setHover(0)}
            onClick={() => onChange?.(star)}
            className={`${starSize} transition-all ${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}>
            <svg viewBox="0 0 20 20" fill={filled ? '#F59E0B' : 'none'}
              stroke={filled ? '#F59E0B' : '#52525B'} strokeWidth="1.5">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292z" />
            </svg>
          </button>
        );
      })}
      {showValue && rating > 0 && (
        <span className="text-xs text-zinc-400 ml-1">{rating.toFixed(1)}</span>
      )}
      {count !== undefined && count > 0 && (
        <span className="text-[10px] text-zinc-500 ml-0.5">({count})</span>
      )}
    </div>
  );
}
