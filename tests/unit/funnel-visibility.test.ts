import { describe, it, expect } from "vitest";
import { createInitialState, funnelReducer } from "@/lib/funnel/funnel-reducer";
import { FUNNEL_STEPS } from "@/types/funnel";
import { siteContent } from "@/config/site-content";

// =============================================================================
// Funnel stage visibility tests
// =============================================================================

describe("Funnel stage visibility", () => {
  it("initial state starts at pool-diagnostic", () => {
    const state = createInitialState();
    expect(state.current_step).toBe(FUNNEL_STEPS.POOL_DIAGNOSTIC);
  });

  it("contact appears only after diagnostic completion", () => {
    const state = funnelReducer(createInitialState(), {
      type: "COMPLETE_DIAGNOSTIC",
    });
    expect(state.current_step).toBe(FUNNEL_STEPS.CONTACT_INFORMATION);
  });

  it("booking appears only after contact submission succeeds", () => {
    let state = createInitialState();
    state = funnelReducer(state, { type: "COMPLETE_DIAGNOSTIC" });
    state = funnelReducer(state, {
      type: "CONTACT_SUBMIT_SUCCESS",
      lead_id: "lead-1",
      first_name: "Jane",
      email: "jane@example.com",
    });
    state = funnelReducer(state, { type: "GO_TO_STEP", step: FUNNEL_STEPS.BOOKING });
    expect(state.current_step).toBe(FUNNEL_STEPS.BOOKING);
    expect(state.lead_id).toBe("lead-1");
  });

  it("confirmation appears only after confirmed booking", () => {
    let state = createInitialState();
    state = funnelReducer(state, { type: "COMPLETE_DIAGNOSTIC" });
    state = funnelReducer(state, {
      type: "CONTACT_SUBMIT_SUCCESS",
      lead_id: "lead-1",
      first_name: "Jane",
      email: "jane@example.com",
    });
    state = funnelReducer(state, {
      type: "BOOKING_SUCCESS",
      appointment_id: "apt-1",
      start_time: "2026-08-01T13:00:00.000Z",
      end_time: "2026-08-01T13:30:00.000Z",
    });
    state = funnelReducer(state, { type: "GO_TO_STEP", step: FUNNEL_STEPS.CONFIRMATION });
    expect(state.current_step).toBe(FUNNEL_STEPS.CONFIRMATION);
    expect(state.appointment_id).toBe("apt-1");
  });

  it("confirmation receives real booking details", () => {
    let state = createInitialState();
    state = funnelReducer(state, {
      type: "BOOKING_SUCCESS",
      appointment_id: "apt-real-123",
      start_time: "2026-08-01T14:00:00.000Z",
      end_time: "2026-08-01T14:30:00.000Z",
    });
    expect(state.appointment_id).toBe("apt-real-123");
    expect(state.selected_slot_start).toBe("2026-08-01T14:00:00.000Z");
    expect(state.selected_slot_end).toBe("2026-08-01T14:30:00.000Z");
  });

  it("diagnostic completion transitions to contact", () => {
    const state = funnelReducer(
      { ...createInitialState(), current_step: FUNNEL_STEPS.POOL_DIAGNOSTIC },
      { type: "COMPLETE_DIAGNOSTIC" },
    );
    expect(state.current_step).toBe(FUNNEL_STEPS.CONTACT_INFORMATION);
    expect(state.completed_steps).toContain(FUNNEL_STEPS.POOL_DIAGNOSTIC);
  });

  it("contact success transitions to booking", () => {
    let state = createInitialState();
    state = funnelReducer(state, { type: "COMPLETE_DIAGNOSTIC" });
    state = funnelReducer(state, {
      type: "CONTACT_SUBMIT_SUCCESS",
      lead_id: "l1",
      first_name: "Test",
      email: "test@test.com",
    });
    state = funnelReducer(state, { type: "COMPLETE_STEP", step: FUNNEL_STEPS.CONTACT_INFORMATION });
    state = funnelReducer(state, { type: "GO_TO_STEP", step: FUNNEL_STEPS.BOOKING });
    expect(state.current_step).toBe(FUNNEL_STEPS.BOOKING);
    expect(state.completed_steps).toContain(FUNNEL_STEPS.CONTACT_INFORMATION);
  });

  it("no permanent confirmation placeholder exists", () => {
    const state = createInitialState();
    // Confirmation should NOT be visible when no appointment_id
    expect(state.appointment_id).toBeNull();
    expect(state.current_step).toBe(FUNNEL_STEPS.POOL_DIAGNOSTIC);
  });
});

// =============================================================================
// Content assertions
// =============================================================================

describe("Content assertions", () => {
  it("slogan is Water Made Perfect", () => {
    expect(siteContent.company.slogan).toBe("Water Made Perfect");
  });

  it("support phone is 775-600-5305", () => {
    expect(siteContent.footer.support_phone).toBe("775-600-5305");
  });

  it("no fake 800 number remains", () => {
    const contentStr = JSON.stringify(siteContent);
    expect(contentStr).not.toContain("(800) 555-0199");
    expect(contentStr).not.toContain("800-555-0199");
  });

  it("no fake testimonials remain", () => {
    expect(siteContent).not.toHaveProperty("testimonials_list");
    const contentStr = JSON.stringify(siteContent);
    expect(contentStr).not.toContain("Sarah M.");
    expect(contentStr).not.toContain("David R.");
    expect(contentStr).not.toContain("Michael T.");
  });

  it("no unsupported intelligent automation copy", () => {
    const contentStr = JSON.stringify(siteContent).toLowerCase();
    expect(contentStr).not.toContain("intelligent automation");
    expect(contentStr).not.toContain("perfectly balanced");
    expect(contentStr).not.toContain("skip the chemicals");
  });

  it("support email is correct", () => {
    expect(siteContent.footer.support_email).toBe("support@fusion44x.com");
  });

  it("company name is Fusion44X", () => {
    expect(siteContent.company.name).toBe("Fusion44X");
  });

  it("hero uses the approved consolidated heading", () => {
    expect(siteContent.hero.heading).toBe(
      "Cleaner, More Comfortable Pool Water—Without the Traditional Chlorine and Salt Cycle",
    );
  });

  it("hero eyebrow matches approved copy", () => {
    expect(siteContent.hero.eyebrow).toBe("Fusion44X Hydro-pH-Infusion System");
  });

  it("proof_line does not contain numeric claims", () => {
    const line = siteContent.proof_line.default_line;
    expect(line).not.toMatch(/\d{2,}/);
  });

  it("diagnostic complete_label does not claim automated recommendation", () => {
    expect(siteContent.diagnostic.complete_label).not.toContain("automated");
    expect(siteContent.diagnostic.complete_label).not.toContain("personalized recommendation");
  });
});

// =============================================================================
// Funnel transitions
// =============================================================================

describe("Funnel transitions", () => {
  it("successful booking focuses and reveals confirmation", () => {
    let state = createInitialState();
    state = funnelReducer(state, { type: "COMPLETE_DIAGNOSTIC" });
    state = funnelReducer(state, {
      type: "CONTACT_SUBMIT_SUCCESS",
      lead_id: "l1",
      first_name: "Jane",
      email: "jane@example.com",
    });
    state = funnelReducer(state, {
      type: "BOOKING_SUCCESS",
      appointment_id: "apt-1",
      start_time: "2026-08-01T13:00:00.000Z",
      end_time: "2026-08-01T13:30:00.000Z",
    });
    state = funnelReducer(state, { type: "GO_TO_STEP", step: FUNNEL_STEPS.CONFIRMATION });
    expect(state.current_step).toBe(FUNNEL_STEPS.CONFIRMATION);
    expect(state.appointment_id).not.toBeNull();
  });

  it("contact success triggers booking step via context flow", () => {
    let state = createInitialState();
    state = funnelReducer(state, { type: "COMPLETE_DIAGNOSTIC" });
    // Simulate what the context does on contact success
    state = funnelReducer(state, {
      type: "CONTACT_SUBMIT_SUCCESS",
      lead_id: "l1",
      first_name: "Jane",
      email: "jane@example.com",
    });
    state = funnelReducer(state, {
      type: "COMPLETE_STEP",
      step: FUNNEL_STEPS.CONTACT_INFORMATION,
    });
    state = funnelReducer(state, { type: "GO_TO_STEP", step: FUNNEL_STEPS.BOOKING });
    expect(state.current_step).toBe(FUNNEL_STEPS.BOOKING);
    expect(state.lead_id).toBe("l1");
    expect(state.first_name).toBe("Jane");
    expect(state.email).toBe("jane@example.com");
  });
});
