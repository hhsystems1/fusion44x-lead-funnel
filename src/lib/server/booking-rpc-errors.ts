export function mapBookingRpcError(
  code: string,
): { status: number; message: string } | null {
  switch (code) {
    case "P0002":
      return { status: 404, message: "Lead or session not found" };
    case "P0003":
      return { status: 403, message: "Session does not match lead" };
    case "P0008":
    case "P0009":
      return { status: 409, message: "Already booked" };
    case "P0010":
      return { status: 409, message: "Time slot is no longer available" };
    default:
      return null;
  }
}