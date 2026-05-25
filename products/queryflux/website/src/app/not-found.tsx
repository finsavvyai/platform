import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        backgroundColor: "white",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ textAlign: "center", maxWidth: "500px" }}>
        <h1
          style={{
            fontSize: "4rem",
            fontWeight: "bold",
            marginBottom: "1rem",
            color: "#111827",
            margin: "0 0 1rem 0",
          }}
        >
          404
        </h1>
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: "600",
            marginBottom: "1rem",
            color: "#374151",
            margin: "0 0 1rem 0",
          }}
        >
          Page Not Found
        </h2>
        <p
          style={{
            color: "#6b7280",
            marginBottom: "2rem",
            lineHeight: 1.6,
          }}
        >
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "0.75rem 1.5rem",
            backgroundColor: "#000000",
            color: "#ffffff",
            borderRadius: "0.5rem",
            textDecoration: "none",
            fontWeight: "500",
          }}
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
