"use client";

import { useState } from "react";

/* The sign-in's password field, with its show/hide eye.

   An EQUIVALENT of components/shared/PasswordInput rather than a restyle of
   it, for one reason: that component's eye is aria-hidden and tabIndex=-1
   (it sits inside the field's <label>, where any accessible text would
   pollute the input's name), so a keyboard can never reach it. Here the eye
   sits OUTSIDE the label and is a real toggle button in the tab order:
   identifier → password → eye → Sign in.

   Its accessible name is "Show" (not "Show password") with aria-pressed for
   the state: Playwright's getByLabel matches any aria-label that CONTAINS
   the text, and ~50 specs sign in with getByLabel("Password"). The full
   sentence is the hover title, which no label query reads.

   Same field as before: a plain named input (`password`), type password ↔
   text, autocomplete current-password, required. */

export function GlassPasswordField({
  label,
  reveal,
  titleShow,
  titleHide,
}: {
  label: string;
  reveal: string;
  titleShow: string;
  titleHide: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="lg-field lg-field--secret">
      <input
        id="lg-password"
        className="lg-input"
        type={visible ? "text" : "password"}
        name="password"
        required
        autoComplete="current-password"
        autoCapitalize="none"
        spellCheck={false}
        /* a single space: the floating label reads :placeholder-shown */
        placeholder=" "
      />
      <label className="lg-label" htmlFor="lg-password">
        {label}
      </label>
      <svg
        className="lg-lead"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="4.5" y="10.5" width="15" height="10" rx="2.6" />
        <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
        <path d="M12 14.6v2.2" />
      </svg>
      <button
        type="button"
        className="lg-eye"
        aria-label={reveal}
        aria-pressed={visible}
        aria-controls="lg-password"
        title={visible ? titleHide : titleShow}
        /* a mouse or a tap must not steal focus from the field (the caret and
           the phone keyboard stay where they are); the keyboard still reaches
           the eye with Tab */
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <path d="M1 1l22 22" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
