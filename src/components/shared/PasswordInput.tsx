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
        onClick={(e) => {
          e.preventDefault();
          setVisible((v) => !v);
        }}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </span>
  );
}
