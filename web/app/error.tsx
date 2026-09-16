"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Next.js App Error:", error);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto py-12 px-4 text-center">
      <div className="border border-neutral-300 rounded-lg p-6 bg-neutral-50 text-left space-y-4">
        <h2 className="text-base font-semibold text-neutral-900">
          Something went wrong
        </h2>
        <div className="p-3 bg-white border border-neutral-200 rounded text-xs font-mono text-neutral-800 break-all">
          {error?.message || "Unknown error occurred"}
        </div>
        {error?.stack && (
          <pre className="p-3 bg-white border border-neutral-200 rounded text-[11px] font-mono text-neutral-600 overflow-x-auto max-h-48">
            {error.stack}
          </pre>
        )}
        <div className="pt-2 text-right">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-black text-white text-xs font-medium rounded hover:bg-neutral-800"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
