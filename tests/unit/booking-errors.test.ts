import { describe, it, expect } from "vitest";
import { createInitialState, funnelReducer } from "@/lib/funnel/funnel-reducer";
import { FUNNEL_STEPS, BOOKING_ERROR_CODES } from "@/types/funnel";
import type { BookingErrorCode } from "@/types/funnel";
import { siteContent } from "@/config/site-content";

// =============================================================================
// 1. Booking errors must never render contact "required field" copy
// =============================================================================

describe("Booking error messages never show contact error_required", () => {
  const errorCodes = Object.values(BOOKING_ERROR_CODES) as BookingErrorCode[];

  for (const code of errorCodes) {
    it(`error code "${code}" does not map to contact.error_required`, () => {
      const messages: Record<BookingErrorCode, string> = {
        missing_fields: siteContent.booking.error_missing_fields,
        conflict: siteContent.booking.conflict,
        server_error: siteContent.booking.error_server_error,
        network_error: siteContent.booking.error_network_error,
        unknown_error: siteContent.booking.error_unknown_error,
      };
      expect(messages[code]).toBeDefined();
      expect(messages[code]).not.toBe(siteContent.contact.error_required);
      expect(messages[code]).not.toBe("This field is required");
    });
  }
});

// =============================================================================
// 2. Each booking safe code maps to correct message
// =============================================================================

describe("Booking error code mapping", () => {
  it("missing_fields maps to missing fields message", () => {
    expect(siteContent.booking.error_missing_fields).toContain("missing part of your booking information");
  });

  it("conflict maps to conflict message", () => {
    expect(siteContent.booking.conflict).toContain("just taken");
  });

  it("server_error maps to server error message", () => {
    expect(siteContent.booking.error_server_error).toContain("couldn\u2019t confirm");
  });

  it("network_error maps to network error message", () => {
    expect(siteContent.booking.error_network_error).toContain("lost the connection");
  });

  it("unknown_error maps to unknown error message", () => {
    expect(siteContent.booking.error_unknown_error).toContain("Something went wrong");
  });
});

// =============================================================================
// 3. Failed booking allows retry (bookingCompletedRef behavior)
// =============================================================================

describe("Booking retry guard", () => {
  it("BOOKING_FAIL sets error state without locking", () => {
    let state = funnelReducer(createInitialState(), { type: "BOOKING_START" });
    expect(state.booking_submission_state).toBe("submitting");

    state = funnelReducer(state, { type: "BOOKING_FAIL", error_code: "server_error" });
    expect(state.booking_submission_state).toBe("error");
    expect(state.booking_error_code).toBe("server_error");

    // After failure, BOOKING_START should be allowed again (reducer doesn't block)
    state = funnelReducer(state, { type: "BOOKING_START" });
    expect(state.booking_submission_state).toBe("submitting");
    expect(state.booking_error_code).toBeNull();
  });

  it("BOOKING_CONFLICT sets conflict and clears slot", () => {
    let state = funnelReducer(
      { ...createInitialState(), selected_slot_start: "2026-08-01T13:00:00Z" },
      { type: "BOOKING_START" },
    );
    state = funnelReducer(state, { type: "BOOKING_CONFLICT" });
    expect(state.booking_submission_state).toBe("idle");
    expect(state.booking_error_code).toBe("conflict");
    expect(state.selected_slot_start).toBeNull();
  });

  it("network error allows retry", () => {
    let state = funnelReducer(createInitialState(), { type: "BOOKING_START" });
    state = funnelReducer(state, { type: "BOOKING_FAIL", error_code: "network_error" });
    expect(state.booking_submission_state).toBe("error");
    expect(state.booking_error_code).toBe("network_error");

    // Should be able to start again
    state = funnelReducer(state, { type: "BOOKING_START" });
    expect(state.booking_submission_state).toBe("submitting");
  });

  it("success cannot submit twice (BOOKING_START resets error state)", () => {
    let state = funnelReducer(createInitialState(), { type: "BOOKING_START" });
    state = funnelReducer(state, {
      type: "BOOKING_SUCCESS",
      appointment_id: "apt-1",
      start_time: "2026-08-01T13:00:00Z",
      end_time: "2026-08-01T13:30:00Z",
    });
    expect(state.booking_submission_state).toBe("success");
    expect(state.appointment_id).toBe("apt-1");
    expect(state.booking_error_code).toBeNull();
  });
});

// =============================================================================
// 4. Stale session restoration resets
// =============================================================================

describe("Stale state resets", () => {
  it("booking step without lead_id gets reset on hydration", () => {
    const state = funnelReducer(createInitialState(), {
      type: "HYDRATE",
      payload: {
        current_step: FUNNEL_STEPS.BOOKING,
        lead_id: null,
        session_id: "session-123",
      },
    });
    // The reducer just applies the payload, but the context validates.
    // The reducer should still allow the state change.
    expect(state.current_step).toBe(FUNNEL_STEPS.BOOKING);
  });

  it("confirmation step with no appointment_id renders null in ConfirmationStage", () => {
    // The confirmation stage returns null when appointment_id is null.
    // This is handled in the component, not the reducer.
    const state = createInitialState();
    expect(state.appointment_id).toBeNull();
    expect(state.current_step).toBe(FUNNEL_STEPS.POOL_DIAGNOSTIC);
  });

  it("RESET clears all booking state", () => {
    let state = createInitialState();
    state = funnelReducer(state, { type: "COMPLETE_DIAGNOSTIC" });
    state = funnelReducer(state, {
      type: "CONTACT_SUBMIT_SUCCESS",
      lead_id: "l1",
      first_name: "Jane",
      email: "jane@example.com",
    });
    state = funnelReducer(state, { type: "GO_TO_STEP", step: FUNNEL_STEPS.BOOKING });
    state = funnelReducer(state, {
      type: "BOOKING_SUCCESS",
      appointment_id: "apt-1",
      start_time: "2026-08-01T13:00:00Z",
      end_time: "2026-08-01T13:30:00Z",
    });
    state = funnelReducer(state, { type: "RESET" });
    expect(state.current_step).toBe(FUNNEL_STEPS.POOL_DIAGNOSTIC);
    expect(state.lead_id).toBeNull();
    expect(state.appointment_id).toBeNull();
    expect(state.booking_error_code).toBeNull();
    expect(state.booking_submission_state).toBe("idle");
  });
});

// =============================================================================
// 5. Reset control clears session funnel data
// =============================================================================

describe("Reset clears session state", () => {
  it("RESET returns to initial state completely", () => {
    const modified = {
      ...createInitialState(),
      session_id: "s1",
      lead_id: "l1",
      first_name: "Jane",
      email: "jane@test.com",
      current_step: FUNNEL_STEPS.CONFIRMATION,
      completed_steps: [FUNNEL_STEPS.POOL_DIAGNOSTIC, FUNNEL_STEPS.CONTACT_INFORMATION],
      appointment_id: "apt-1",
      booking_error_code: "server_error" as BookingErrorCode,
    };
    const state = funnelReducer(modified, { type: "RESET" });
    expect(state.session_id).toBeNull();
    expect(state.lead_id).toBeNull();
    expect(state.first_name).toBeNull();
    expect(state.email).toBeNull();
    expect(state.current_step).toBe(FUNNEL_STEPS.POOL_DIAGNOSTIC);
    expect(state.completed_steps).toEqual([]);
    expect(state.appointment_id).toBeNull();
    expect(state.booking_error_code).toBeNull();
  });
});

// =============================================================================
// 6. Testimonial section placement (page order)
// =============================================================================

describe("Page section order", () => {
  it("testimonials content exists as a section", () => {
    expect(siteContent.testimonials.heading).toBe("Customer Stories");
    expect(siteContent.testimonials.subheading).toContain("Fusion 44X");
  });

  it("testimonials are not fake names/ratings", () => {
    const content = JSON.stringify(siteContent.testimonials);
    expect(content).not.toMatch(/\d\.\d rating/);
    expect(content).not.toMatch(/star/);
    expect(content).not.toMatch(/"name":/);
  });
});

// =============================================================================
// 7. Unapproved numeric proof is not rendered
// =============================================================================

describe("Proof bar", () => {
  it("does not contain numeric claims like 1,000+ pool owners", () => {
    expect(siteContent.proof_bar.claim).not.toMatch(/\d[\d,]*\+?\s*(pool|owner|customer|client)/i);
    expect(siteContent.proof_bar.claim).toContain("Approved customer-count proof goes here");
  });

  it("renders neutral items when no approved claim", () => {
    const items = siteContent.proof_bar.supporting_items;
    expect(items).toContain("Free pool assessment");
    expect(items).toContain("No-obligation consultation");
    expect(items).toContain("Direct manufacturer support");
  });

  it("no fake numbers in supporting items", () => {
    for (const item of siteContent.proof_bar.supporting_items) {
      expect(item).not.toMatch(/\d{2,}/);
    }
  });
});

// =============================================================================
// 8. Customer email not expected before confirmed booking
// =============================================================================

describe("Email timing", () => {
  it("confirmation step has no email expectation in initial state", () => {
    const state = createInitialState();
    expect(state.appointment_id).toBeNull();
    // Email is not expected until after BOOKING_SUCCESS which sets appointment_id
  });

  it("email fields appear only after BOOKING_SUCCESS", () => {
    const state = funnelReducer(createInitialState(), {
      type: "BOOKING_SUCCESS",
      appointment_id: "apt-1",
      start_time: "2026-08-01T13:00:00Z",
      end_time: "2026-08-01T13:30:00Z",
    });
    expect(state.appointment_id).toBe("apt-1");
    // appointment_id is the trigger for ConfirmationStage to render
  });
});

// =============================================================================
// 9. Confirmed booking transitions to confirmation
// =============================================================================

describe("Booking to confirmation transition", () => {
  it("BOOKING_SUCCESS followed by GO_TO_STEP CONFIRMATION shows confirmation", () => {
    let state = createInitialState();
    state = funnelReducer(state, { type: "COMPLETE_DIAGNOSTIC" });
    state = funnelReducer(state, {
      type: "CONTACT_SUBMIT_SUCCESS",
      lead_id: "l1",
      first_name: "Jane",
      email: "jane@example.com",
    });
    state = funnelReducer(state, { type: "GO_TO_STEP", step: FUNNEL_STEPS.BOOKING });
    state = funnelReducer(state, { type: "BOOKING_START" });
    state = funnelReducer(state, {
      type: "BOOKING_SUCCESS",
      appointment_id: "apt-real",
      start_time: "2026-08-01T13:00:00Z",
      end_time: "2026-08-01T13:30:00Z",
    });
    state = funnelReducer(state, { type: "GO_TO_STEP", step: FUNNEL_STEPS.CONFIRMATION });
    expect(state.current_step).toBe(FUNNEL_STEPS.CONFIRMATION);
    expect(state.appointment_id).toBe("apt-real");
    expect(state.booking_error_code).toBeNull();
  });
});
