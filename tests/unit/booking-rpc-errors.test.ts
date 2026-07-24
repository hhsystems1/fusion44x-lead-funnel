import { describe, it, expect } from "vitest";
import { mapBookingRpcError } from "@/lib/server/booking-rpc-errors";

describe("mapBookingRpcError", () => {
  it("maps P0002 to 404", () => {
    expect(mapBookingRpcError("P0002")).toEqual({ status: 404, message: "Lead or session not found" });
  });

  it("maps P0003 to 403", () => {
    expect(mapBookingRpcError("P0003")).toEqual({ status: 403, message: "Session does not match lead" });
  });

  it("maps P0008 to 409 already booked", () => {
    expect(mapBookingRpcError("P0008")).toEqual({ status: 409, message: "Already booked" });
  });

  it("maps P0009 to 409 already booked", () => {
    expect(mapBookingRpcError("P0009")).toEqual({ status: 409, message: "Already booked" });
  });

  it("maps P0010 to 409 slot conflict", () => {
    expect(mapBookingRpcError("P0010")).toEqual({ status: 409, message: "Time slot is no longer available" });
  });

  it("maps P0011 to 409 concurrent conflict", () => {
    expect(mapBookingRpcError("P0011")).toEqual({ status: 409, message: "Concurrent booking conflict" });
  });

  it("maps P0012 to 422", () => {
    expect(mapBookingRpcError("P0012")).toEqual({ status: 422, message: "Invalid booking request" });
  });

  it("maps P0013 to 422", () => {
    expect(mapBookingRpcError("P0013")).toEqual({ status: 422, message: "Invalid booking request" });
  });

  it("maps P0014 to 422", () => {
    expect(mapBookingRpcError("P0014")).toEqual({ status: 422, message: "Invalid booking request" });
  });

  it("maps P0015 to 422", () => {
    expect(mapBookingRpcError("P0015")).toEqual({ status: 422, message: "Invalid booking request" });
  });

  it("maps P0016 to 422", () => {
    expect(mapBookingRpcError("P0016")).toEqual({ status: 422, message: "Invalid booking request" });
  });

  it("maps P0017 to 422 invalid timezone", () => {
    expect(mapBookingRpcError("P0017")).toEqual({ status: 422, message: "Invalid timezone" });
  });

  it("maps P0018 to 422 invalid provider", () => {
    expect(mapBookingRpcError("P0018")).toEqual({ status: 422, message: "Invalid provider" });
  });

  it("maps P0019 to 422 invalid duration", () => {
    expect(mapBookingRpcError("P0019")).toEqual({ status: 422, message: "Invalid duration" });
  });

  it("maps P0020 to 409 duplicate booking", () => {
    expect(mapBookingRpcError("P0020")).toEqual({ status: 409, message: "Duplicate booking request" });
  });

  it("returns null for unknown error codes", () => {
    expect(mapBookingRpcError("P9999")).toBeNull();
  });

  it("returns null for undefined code", () => {
    expect(mapBookingRpcError(undefined as unknown as string)).toBeNull();
  });
});