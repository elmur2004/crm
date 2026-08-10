"use client";

import { useState } from "react";

/* Password field with a Show/Hide toggle (founder). Renders a plain named
   input, so forms and label associations keep working unchanged. */

export function PasswordInput({
  name,
  ariaLabel,
  required,
  minLength,
  autoComplete,
  placeholder,
  className = "field-input",
}: {
  name: string;
  /** the field label text — set explicitly so the toggle text can never pollute the input's accessible name */
  ariaLabel: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  placeholder?: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="pw-wrap">
      <input
        type={visible ? "text" : "password"}
        aria-label={ariaLabel}
        name={name}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={className}
      />
      {/* mouse-only helper, EXCLUDED from the accessibility tree: it sits inside
          the field's <label>, so any accessible text here would pollute the
          input's accessible name (and break exact label queries) */}
      <button
        type="button"
        className="pw-toggle"
        aria-hidden="true"
        tabIndex={-1}
        title={visible ? "Hide password" : "Show password"}
        onClick={(e) => {
          e.preventDefault();
          setVisible((v) => !v);
        }}
      >
        {visible ? (
          /* eye-off */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          /* eye */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </span>
  );
}
