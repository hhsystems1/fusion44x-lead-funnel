import { describe, it, expect } from "vitest";
import { mapBookingRpcError } from "@/lib/server/booking-rpc-errors";

describe("mapBookingRpcError", () => {
  it("maps P0002 to 404", () => {
    const result = mapBookingRpcError("P0002");
    expect(result).toEqual({ status: 404, message: "Lead or session not found" });
  });

  it("maps P0003 to 403", () => {
    const result = mapBookingRpcError("P0003");
    expect(result).toEqual({ status: 403, message: "Session does not match lead" });
  });

  it("maps P0008 to 409", () => {
    const result = mapBookingRpcError("P0008");
    expect(result).toEqual({ status: 409, message: "Already booked" });
  });

  it("maps P0009 to 409", () => {
    const result = mapBookingRpcError("P0009");
    expect(result).toEqual({ status: 409, message: "Already booked" });
  });

  it("maps P0010 to 409", () => {
    const result = mapBookingRpcError("P0010");
    expect(result).toEqual({ status: 409, message: "Time slot is no longer available" });
  });

  it("returns null for unknown error codes", () => {
    const result = mapBookingRpcError("P9999");
    expect(result).toBeNull();
  });

  it("returns null for undefined code", () => {
    const result = mapBookingRpcError(undefined as unknown as string);
    expect(result).toBeNull();
  });
});