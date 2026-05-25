// Skill reviews and ratings.

import { Hono } from "hono";
import { verifyJwt } from "./auth";
import type { Env } from "./types";

type Bindings = Env;
export const skillReviewRoutes = new Hono<{ Bindings: Bindings }>();

// GET /:id/reviews — get reviews for a skill
skillReviewRoutes.get("/:id/reviews", async (c) => {
  const skillId = c.req.param("id");

  // Get from KV: reviews:{skillId} -> { reviews: [...], avg: number }
  const raw = await c.env.RUNNERS.get(`reviews:${skillId}`);
  if (!raw) return c.json({ reviews: [], avg: 0, count: 0 });

  const data = JSON.parse(raw) as { reviews: Review[] };
  const avg = data.reviews.length > 0
    ? data.reviews.reduce((s, r) => s + r.rating, 0) / data.reviews.length
    : 0;

  return c.json({
    reviews: data.reviews.slice(0, 20),
    avg: Math.round(avg * 10) / 10,
    count: data.reviews.length,
  });
});

// POST /:id/reviews — submit a review
skillReviewRoutes.post("/:id/reviews", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const user = await verifyJwt(token, c.env.JWT_SECRET);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const skillId = c.req.param("id");
  const body = await c.req.json<{ rating: number; comment?: string }>();
  const rating = Math.min(5, Math.max(1, Math.round(body.rating || 0)));
  if (!rating) return c.json({ error: "rating 1-5 required" }, 400);

  const comment = (body.comment ?? "").slice(0, 500);
  const key = `reviews:${skillId}`;
  const raw = await c.env.RUNNERS.get(key);
  const data: { reviews: Review[] } = raw ? JSON.parse(raw) : { reviews: [] };

  // Replace existing review from same user or add new
  const existing = data.reviews.findIndex(r => r.user_sub === user.sub);
  const review: Review = {
    user_sub: user.sub,
    login: user.login,
    rating,
    comment,
    created_at: new Date().toISOString(),
  };
  if (existing >= 0) {
    data.reviews[existing] = review;
  } else {
    data.reviews.unshift(review);
  }

  // Keep max 50 reviews
  data.reviews = data.reviews.slice(0, 50);
  await c.env.RUNNERS.put(key, JSON.stringify(data));

  const avg = data.reviews.reduce((s, r) => s + r.rating, 0) / data.reviews.length;
  return c.json({ ok: true, avg: Math.round(avg * 10) / 10, count: data.reviews.length });
});

interface Review {
  user_sub: string;
  login: string;
  rating: number;
  comment: string;
  created_at: string;
}
