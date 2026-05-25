import { NextResponse } from "next/server";
// Edge auth middleware is intentionally kept as a no-op for the landing app.
// Auth enforcement happens in API routes and protected pages to keep the
// Pages Router build stable under Next.js + Clerk + Cloudflare Pages.
export default function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
