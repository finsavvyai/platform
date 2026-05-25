import { useState } from 'react';
import StarRating from '../StarRating';
import { API_BASE_URL } from '../../config';

interface Props {
  skillId: string;
  avgRating: number;
  reviewCount: number;
  reviews: Array<{ login: string; rating: number; comment: string; created_at: string }>;
  onRatingUpdate: (avg: number, count: number) => void;
}

export default function SkillReviews({ skillId, avgRating, reviewCount, reviews, onRatingUpdate }: Props) {
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitReview = async () => {
    if (!myRating) return;
    setSubmitting(true);
    const token = localStorage.getItem('pushci_token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/skills/${skillId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ rating: myRating, comment: myComment }),
      });
      if (res.ok) {
        const d = await res.json() as { avg: number; count: number };
        onRatingUpdate(d.avg, d.count);
      }
    } catch {} finally { setSubmitting(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-zinc-200">Ratings & Reviews</h3>
        <StarRating rating={avgRating} size="sm" showValue count={reviewCount} />
      </div>
      <div className="flex items-center gap-3 mb-3 px-3 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
        <span className="text-xs text-zinc-400">Your rating:</span>
        <StarRating rating={myRating} onChange={setMyRating} size="md" />
        <input value={myComment} onChange={e => setMyComment(e.target.value)} placeholder="Optional comment..."
          className="flex-1 text-xs bg-transparent border-none text-zinc-300 focus:outline-none" />
        <button onClick={submitReview} disabled={!myRating || submitting}
          className="text-xs text-emerald-400 hover:text-emerald-300 disabled:text-zinc-600 transition">
          {submitting ? '...' : 'Submit'}
        </button>
      </div>
      {reviews.length > 0 && (
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {reviews.slice(0, 5).map((r, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/30">
              <span className="text-xs text-zinc-400 w-16 truncate">{r.login}</span>
              <StarRating rating={r.rating} size="sm" />
              {r.comment && <span className="text-[11px] text-zinc-500 truncate flex-1">{r.comment}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
