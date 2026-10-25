"use client";

import { useFormStatus } from "react-dom";

/* The sign-in CTA. A client island only so it can read useFormStatus: while
   the `login` action runs, the arrow badge becomes a spinner and a shimmer
   crosses the glass (both motion-gated in login.css; under reduced motion the
   spinner is a still ring). It is also disabled for that moment, so a second
   tap cannot queue a second sign-in.

   The accessible name is the label alone — "Sign in", byte-identical, and it
   does NOT change while pending (the e2e suite finds this button by name).
   Badge, sheen and glow are aria-hidden. */

export function GlassSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="lg-cta">
      <span className="lg-cta-glow" aria-hidden="true" />
      <button
        type="submit"
        className="lg-submit"
        disabled={pending}
        aria-busy={pending || undefined}
        data-pending={pending ? "" : undefined}
      >
        <span className="lg-submit-sheen" aria-hidden="true" />
        <span className="lg-submit-label">{label}</span>
        <span className="lg-badge" aria-hidden="true">
          <svg
            className="lg-arrow"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            focusable="false"
          >
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
          <span className="lg-spinner" />
        </span>
      </button>
    </div>
  );
}
