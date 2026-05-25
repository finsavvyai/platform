const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
const secretKey = process.env.CLERK_SECRET_KEY || "";

export function hasValidClerkKeys(): boolean {
  return (
    publishableKey.startsWith("pk_") &&
    secretKey.startsWith("sk_") &&
    !publishableKey.includes("placeholder") &&
    !secretKey.includes("placeholder")
  );
}
