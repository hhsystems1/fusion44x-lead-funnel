"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { siteContent } from "@/config/site-content";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { FUNNEL_STEPS } from "@/types/funnel";
import { InternalEvents } from "@/config/tracking-events";
import { initializeSession } from "@/lib/funnel/session";
import { TextInput } from "@/components/ui/text-input";
import { Checkbox } from "@/components/ui/checkbox";
import { CtaButton } from "@/components/ui/cta-button";

const SHOWN_KEY = "fusion44x_exit_popup_shown";
const SUBMITTED_KEY = "fusion44x_exit_popup_submitted";

const exitPopupFormSchema = z.object({
  name: z.string().trim().min(1, "This field is required").max(200),
  email: z.string().trim().max(320).email("Please enter a valid email address"),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(
      /^[\d\s\-().+]*$/,
      "Phone can only contain digits, spaces, and the characters -().+",
    )
    .optional()
    .default(""),
  consent_to_contact: z.literal(true, {
    message: "You must agree to be contacted to proceed",
  }),
});

export function splitName(name: string): { first_name: string; last_name: string } {
  const trimmed = name.trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) return { first_name: trimmed, last_name: "" };
  return {
    first_name: trimmed.slice(0, spaceIndex),
    last_name: trimmed.slice(spaceIndex + 1).trim(),
  };
}

function readStorage(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeStorage(key: string): void {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* silent */
  }
}

export function ExitPopup() {
  const { state, tracker } = useFunnel();
  const [isOpen, setIsOpen] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    consent_to_contact: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const firstErrorRef = useRef<HTMLInputElement | null>(null);

  const isRenderSuppressed = useCallback(() => {
    if (state.lead_id) return true;
    if (state.current_step === FUNNEL_STEPS.CONFIRMATION) return true;
    if (state.submission_state === "success") return true;
    return false;
  }, [state.lead_id, state.current_step, state.submission_state]);

  const tryShowPopup = useCallback(() => {
    if (isOpen) return;
    if (readStorage(SHOWN_KEY)) return;
    if (readStorage(SUBMITTED_KEY)) return;
    if (isRenderSuppressed()) return;
    writeStorage(SHOWN_KEY);
    setIsOpen(true);
    if (tracker) {
      tracker.track(InternalEvents.PAGE_EXIT_ATTEMPTED, {
        step_id: state.current_step,
      });
    }
  }, [isOpen, isRenderSuppressed, tracker, state.current_step]);

  // Exit-intent detection: mouse leaving the top of the viewport
  useEffect(() => {
    function handleMouseLeave(e: MouseEvent) {
      if (e.clientY <= 0) tryShowPopup();
    }
    document.documentElement.addEventListener("mouseout", handleMouseLeave);
    return () =>
      document.documentElement.removeEventListener("mouseout", handleMouseLeave);
  }, [tryShowPopup]);

  // Mobile tab-hide / app-switch detection
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") tryShowPopup();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [tryShowPopup]);

  // Focus management + Escape close while open
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        return;
      }
      if (e.key === "Tab") {
        const modal = document.getElementById("exit-popup-modal");
        if (!modal) return;
        const focusable = modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (isRenderSuppressed()) return null;

  function handleChange(field: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setHasSubmitted(true);
    setSubmitError(null);

    const validation = exitPopupFormSchema.safeParse(form);
    if (!validation.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const path = issue.path.join(".");
        if (!nextErrors[path]) nextErrors[path] = issue.message;
      }
      setErrors(nextErrors);
      setTimeout(() => firstErrorRef.current?.focus(), 100);
      return;
    }

    let sessionId = state.session_id;
    if (!sessionId) {
      const retried = await initializeSession();
      if (retried) {
        sessionId = retried.session_id;
      }
    }
    if (!sessionId) {
      setSubmitError("Something went wrong. Please try again.");
      return;
    }

    setSubmitting(true);
    const { first_name, last_name } = splitName(validation.data.name);

    try {
      const response = await fetch("/api/exit-popup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          contact: {
            first_name,
            last_name,
            email: validation.data.email,
            phone: validation.data.phone || undefined,
          },
          consent: {
            consent_to_contact: true,
            marketing_consent: false,
            consent_text_version: "exit-popup-v1",
          },
        }),
      });

      if (response.status === 409) {
        // Already captured in this session — treat as success
        writeStorage(SUBMITTED_KEY);
        setHasSubmitted(false);
        return;
      }

      if (!response.ok) {
        setSubmitError("Something went wrong. Please try again.");
        return;
      }

      writeStorage(SUBMITTED_KEY);
      setHasSubmitted(false);
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const content = siteContent.exit_popup;
  const showErrors = hasSubmitted && !submitting && !submitError;

  return (
    <div
      id="exit-popup-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-popup-title"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        {readStorage(SUBMITTED_KEY) ? (
          <div className="text-center">
            <h2
              id="exit-popup-title"
              className="text-xl font-bold text-brand-navy"
            >
              {content.success_heading}
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              {content.success_message}
            </p>
            <button
              ref={closeButtonRef}
              onClick={() => setIsOpen(false)}
              className="mt-6 text-sm text-neutral-400 underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-neutral-600"
            >
              {content.close}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <h2
                id="exit-popup-title"
                className="text-xl font-bold text-brand-navy"
              >
                {content.heading}
              </h2>
              <button
                ref={closeButtonRef}
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <p className="mt-2 text-sm text-neutral-600">{content.subheading}</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <TextInput
                label={content.name}
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                error={showErrors ? errors.name : undefined}
                required
                autoComplete="name"
                ref={showErrors && errors.name ? firstErrorRef : undefined}
              />
              <TextInput
                label={content.email}
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                error={showErrors ? errors.email : undefined}
                required
                autoComplete="email"
                ref={
                  showErrors && !errors.name && errors.email
                    ? firstErrorRef
                    : undefined
                }
              />
              <TextInput
                label={content.phone_optional}
                type="tel"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                error={showErrors ? errors.phone : undefined}
                autoComplete="tel"
              />
              <Checkbox
                label={content.consent}
                checked={form.consent_to_contact}
                onChange={(e) =>
                  handleChange("consent_to_contact", e.target.checked)
                }
                error={showErrors ? errors.consent_to_contact : undefined}
                required
              />

              {submitError && (
                <p className="text-sm text-red-600" role="alert">
                  {submitError}
                </p>
              )}

              <div className="pt-1">
                <CtaButton
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full"
                  loading={submitting}
                >
                  {submitting ? content.submitting : content.submit}
                </CtaButton>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
