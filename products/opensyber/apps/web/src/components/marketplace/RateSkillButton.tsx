'use client';

import { useState } from 'react';
import { Star, Check } from 'lucide-react';

export function RateSkillButton({ skillId }: { skillId: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (rating === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/marketplace/${skillId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, review: review.trim() || undefined }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { message?: string }).message ?? 'Rating failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6 text-center">
        <div className="flex items-center justify-center gap-2 text-green-400">
          <Check className="h-5 w-5" />
          <span className="text-sm font-medium">Thank you for your review!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <h3 className="text-sm font-medium text-neutral-300 mb-3">Rate this skill</h3>
      <div className="flex items-center gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="transition"
          >
            <Star
              className={`h-6 w-6 ${
                star <= (hover || rating)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-neutral-600'
              }`}
            />
          </button>
        ))}
        {rating > 0 && <span className="ml-2 text-xs text-neutral-400">{rating}/5</span>}
      </div>
      <textarea
        value={review}
        onChange={(e) => setReview(e.target.value)}
        placeholder="Write a review (optional)..."
        rows={3}
        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-signal focus:outline-none resize-none mb-3"
      />
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={rating === 0 || loading}
        className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-white hover:bg-info transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Submitting...' : 'Submit Rating'}
      </button>
    </div>
  );
}
