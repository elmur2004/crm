"use client";

/* Print the current page (the print CSS strips the app chrome). */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn-primary no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}
