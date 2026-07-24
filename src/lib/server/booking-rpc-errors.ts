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
    case "P0011":
      return { status: 409, message: "Concurrent booking conflict" };
    case "P0012":
    case "P0013":
    case "P0014":
    case "P0015":
    case "P0016":
      return { status: 422, message: "Invalid booking request" };
    case "P0017":
      return { status: 422, message: "Invalid timezone" };
    case "P0018":
      return { status: 422, message: "Invalid provider" };
    case "P0019":
      return { status: 422, message: "Invalid duration" };
    case "P0020":
      return { status: 409, message: "Duplicate booking" };
    default:
      return null;
  }
}