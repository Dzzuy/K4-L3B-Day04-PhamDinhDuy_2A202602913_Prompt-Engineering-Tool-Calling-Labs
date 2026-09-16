"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 40, fontFamily: "system-ui, sans-serif", backgroundColor: "#fff", color: "#171717", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <div style={{ maxWidth: 440, width: "100%", border: "1px solid #e5e5e5", borderRadius: 8, padding: 24, textAlign: "center" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px 0" }}>Session Reset</h2>
          <p style={{ fontSize: 13, color: "#737373", margin: "0 0 20px 0" }}>
            The application state has refreshed. Please return to Analyze to continue.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <button
              onClick={() => reset()}
              style={{ padding: "8px 16px", fontSize: 12, border: "1px solid #d4d4d4", borderRadius: 6, background: "#fff", cursor: "pointer" }}
            >
              Try Again
            </button>
            <a
              href="/analyze"
              style={{ padding: "8px 16px", fontSize: 12, border: "1px solid #000", borderRadius: 6, background: "#000", color: "#fff", textDecoration: "none", cursor: "pointer" }}
            >
              Go to Analyze
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
