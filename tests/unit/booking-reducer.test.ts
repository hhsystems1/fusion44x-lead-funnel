import { describe, it, expect } from "vitest";
import {
  funnelReducer,
  createInitialState,
} from "@/lib/funnel/funnel-reducer";

function fresh() {
  return { ...createInitialState() };
}

describe("booking reducer actions", () => {
  describe("SELECT_DATE", () => {
    it("sets selected_date and clears previous slot selection", () => {
      const s1 = funnelReducer(
        { ...fresh(), selected_slot_start: "2026-07-28T14:00:00Z", selected_slot_end: "2026-07-28T14:30:00Z" },
        { type: "SELECT_DATE", date: "2026-07-29" },
      );
      expect(s1.selected_date).toBe("2026-07-29");
      expect(s1.selected_slot_start).toBeNull();
      expect(s1.selected_slot_end).toBeNull();
    });

    it("resets booking error on date change", () => {
      const s1 = funnelReducer(
        { ...fresh(), booking_error_code: "conflict" as const },
        { type: "SELECT_DATE", date: "2026-07-29" },
      );
      expect(s1.booking_error_code).toBeNull();
      expect(s1.booking_submission_state).toBe("idle");
    });
  });

  describe("SELECT_SLOT", () => {
    it("sets selected slot start and end", () => {
      const state = funnelReducer(fresh(), {
        type: "SELECT_SLOT",
        start: "2026-07-28T14:00:00Z",
        end: "2026-07-28T14:30:00Z",
      });
      expect(state.selected_slot_start).toBe("2026-07-28T14:00:00Z");
      expect(state.selected_slot_end).toBe("2026-07-28T14:30:00Z");
    });
  });

  describe("BOOKING_START", () => {
    it("sets booking submission state to submitting", () => {
      const state = funnelReducer(fresh(), { type: "BOOKING_START" });
      expect(state.booking_submission_state).toBe("submitting");
      expect(state.booking_error_code).toBeNull();
    });
  });

  describe("BOOKING_SUCCESS", () => {
    it("stores appointment id and transitions to success", () => {
      const state = funnelReducer(fresh(), {
        type: "BOOKING_SUCCESS",
        appointment_id: "appt-123",
        start_time: "2026-07-28T14:00:00Z",
        end_time: "2026-07-28T14:30:00Z",
      });
      expect(state.booking_submission_state).toBe("success");
      expect(state.appointment_id).toBe("appt-123");
      expect(state.selected_slot_start).toBe("2026-07-28T14:00:00Z");
      expect(state.selected_slot_end).toBe("2026-07-28T14:30:00Z");
    });
  });

  describe("BOOKING_FAIL", () => {
    it("sets error state with code", () => {
      const state = funnelReducer(fresh(), {
        type: "BOOKING_FAIL",
        error_code: "server_error",
      });
      expect(state.booking_submission_state).toBe("error");
      expect(state.booking_error_code).toBe("server_error");
    });
  });

  describe("BOOKING_CONFLICT", () => {
    it("resets submission state and clears slot selection", () => {
      const state = funnelReducer(
        {
          ...fresh(),
          selected_slot_start: "2026-07-28T14:00:00Z",
          booking_submission_state: "submitting",
        },
        { type: "BOOKING_CONFLICT" },
      );
      expect(state.booking_submission_state).toBe("idle");
      expect(state.selected_slot_start).toBeNull();
      expect(state.selected_slot_end).toBeNull();
      expect(state.booking_error_code).toBe("conflict");
    });
  });

  describe("CLEAR_BOOKING_SELECTION", () => {
    it("resets all booking state", () => {
      const state = funnelReducer(
        {
          ...fresh(),
          selected_date: "2026-07-28",
          selected_slot_start: "2026-07-28T14:00:00Z",
          selected_slot_end: "2026-07-28T14:30:00Z",
          appointment_id: "appt-123",
          booking_submission_state: "success",
          booking_error_code: null,
        },
        { type: "CLEAR_BOOKING_SELECTION" },
      );
      expect(state.selected_date).toBeNull();
      expect(state.selected_slot_start).toBeNull();
      expect(state.selected_slot_end).toBeNull();
      expect(state.appointment_id).toBeNull();
      expect(state.booking_submission_state).toBe("idle");
      expect(state.booking_error_code).toBeNull();
    });
  });

  describe("booking transitions", () => {
    it("start → success → confirmation step transition", () => {
      const s1 = funnelReducer(fresh(), { type: "BOOKING_START" });
      expect(s1.booking_submission_state).toBe("submitting");

      const s2 = funnelReducer(s1, {
        type: "BOOKING_SUCCESS",
        appointment_id: "appt-123",
        start_time: "2026-07-28T14:00:00Z",
        end_time: "2026-07-28T14:30:00Z",
      });
      expect(s2.booking_submission_state).toBe("success");
      expect(s2.appointment_id).toBe("appt-123");
    });

    it("start → conflict → idle with error code", () => {
      const s1 = funnelReducer(fresh(), { type: "BOOKING_START" });
      expect(s1.booking_submission_state).toBe("submitting");

      const s2 = funnelReducer(s1, { type: "BOOKING_CONFLICT" });
      expect(s2.booking_submission_state).toBe("idle");
      expect(s2.booking_error_code).toBe("conflict");
    });

    it("start → fail → error", () => {
      const s1 = funnelReducer(fresh(), { type: "BOOKING_START" });
      const s2 = funnelReducer(s1, { type: "BOOKING_FAIL", error_code: "network_error" });
      expect(s2.booking_submission_state).toBe("error");
      expect(s2.booking_error_code).toBe("network_error");
    });
  });

  describe("initial state has booking fields at defaults", () => {
    it("starts with null booking fields", () => {
      const state = fresh();
      expect(state.selected_date).toBeNull();
      expect(state.selected_slot_start).toBeNull();
      expect(state.selected_slot_end).toBeNull();
      expect(state.appointment_id).toBeNull();
      expect(state.booking_submission_state).toBe("idle");
      expect(state.booking_error_code).toBeNull();
    });
  });
});