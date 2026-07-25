"use client";

import { useState, type FormEvent } from "react";
import { siteContent } from "@/config/site-content";
import { useFunnel } from "@/lib/funnel/funnel-context";
import { SectionContainer } from "@/components/ui/section-container";
import { TextInput } from "@/components/ui/text-input";
import { Checkbox } from "@/components/ui/checkbox";
import { CtaButton } from "@/components/ui/cta-button";
import { ErrorMessage } from "@/components/ui/error-message";

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  zip_code: string;
  preferred_contact_method: "" | "email" | "phone" | "text";
  consent_to_contact: boolean;
  marketing_consent: boolean;
}

const initialForm: FormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  zip_code: "",
  preferred_contact_method: "",
  consent_to_contact: false,
  marketing_consent: false,
};

export function ContactSection() {
  const { state, submitContact, isDiagValid } = useFunnel();
  const [form, setForm] = useState<FormState>(initialForm);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  if (!isDiagValid()) {
    return null;
  }

  if (state.submission_state === "success") {
    return null;
  }

  function handleChange(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setHasSubmitted(true);

    await submitContact({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone,
      zip_code: form.zip_code,
      preferred_contact_method:
        form.preferred_contact_method || undefined,
      consent_to_contact: form.consent_to_contact as true,
      marketing_consent: form.marketing_consent,
    });
  }

  const errors = state.validation_errors;
  const showErrors = hasSubmitted;

  if (state.submission_state === "duplicate") {
    return (
      <SectionContainer id="contact-information" background="white">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-6 py-8 text-center">
          <h2 className="text-xl font-semibold text-amber-800">
            Already Submitted
          </h2>
          <p className="mt-2 text-amber-700">
            Your session has already been submitted. A specialist will
            contact you shortly.
          </p>
        </div>
      </SectionContainer>
    );
  }

  if (state.submission_state === "error") {
    return (
      <SectionContainer id="contact-information" background="white">
        <ErrorMessage message="Something went wrong. Please try again later." />
      </SectionContainer>
    );
  }

  return (
    <SectionContainer id="contact-information" background="light">
      <div className="text-center">
        <h2
          id="contact-heading"
          className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl"
        >
          {siteContent.contact.heading}
        </h2>
        <p className="mt-3 text-neutral-600">
          {siteContent.contact.subheading}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput
            label={siteContent.contact.first_name}
            value={form.first_name}
            onChange={(e) => handleChange("first_name", e.target.value)}
            error={showErrors ? errors.first_name : undefined}
            required
            autoComplete="given-name"
          />
          <TextInput
            label={siteContent.contact.last_name}
            value={form.last_name}
            onChange={(e) => handleChange("last_name", e.target.value)}
            error={showErrors ? errors.last_name : undefined}
            required
            autoComplete="family-name"
          />
        </div>

        <TextInput
          label={siteContent.contact.email}
          type="email"
          value={form.email}
          onChange={(e) => handleChange("email", e.target.value)}
          error={showErrors ? errors.email : undefined}
          required
          autoComplete="email"
        />

        <TextInput
          label={siteContent.contact.phone}
          type="tel"
          value={form.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          error={showErrors ? errors.phone : undefined}
          required
          autoComplete="tel"
        />

        <TextInput
          label={siteContent.contact.zip_code}
          value={form.zip_code}
          onChange={(e) => handleChange("zip_code", e.target.value)}
          error={showErrors ? errors.zip_code : undefined}
          required
          autoComplete="postal-code"
          maxLength={20}
        />

        <div className="w-full">
          <label
            htmlFor="preferred-contact"
            className="mb-1.5 block text-sm font-medium text-brand-navy"
          >
            {siteContent.contact.preferred_contact}
          </label>
          <select
            id="preferred-contact"
            value={form.preferred_contact_method}
            onChange={(e) =>
              handleChange(
                "preferred_contact_method",
                e.target.value as FormState["preferred_contact_method"],
              )
            }
            className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm transition-colors hover:border-neutral-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-aqua"
          >
            <option value="">
              {siteContent.contact.preferred_contact_placeholder}
            </option>
            <option value="email">
              {siteContent.contact.contact_method_email}
            </option>
            <option value="phone">
              {siteContent.contact.contact_method_phone}
            </option>
            <option value="text">
              {siteContent.contact.contact_method_text}
            </option>
          </select>
        </div>

        <Checkbox
          label={siteContent.contact.consent_to_contact}
          checked={form.consent_to_contact}
          onChange={(e) =>
            handleChange("consent_to_contact", e.target.checked)
          }
          error={showErrors ? errors.consent_to_contact : undefined}
          required
        />

        <Checkbox
          label={siteContent.contact.marketing_consent}
          checked={form.marketing_consent}
          onChange={(e) =>
            handleChange("marketing_consent", e.target.checked)
          }
        />

        <div className="pt-2">
          <CtaButton
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={state.submission_state === "submitting"}
          >
            {state.submission_state === "submitting"
              ? siteContent.contact.submitting
              : siteContent.contact.submit}
          </CtaButton>
        </div>
      </form>
    </SectionContainer>
  );
}
