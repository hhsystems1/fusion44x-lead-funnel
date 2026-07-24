export function mapLeadRpcError(
  code: string,
): { status: number; message: string } | null {
  switch (code) {
    case "P0002":
      return { status: 404, message: "Session not found" };
    case "P0003":
      return { status: 409, message: "Session already linked to a lead" };
    case "P0004":
      return { status: 422, message: "Consent to contact is required" };
    case "P0005":
    case "P0006":
    case "P0007":
      return { status: 422, message: "Validation failed" };
    default:
      return null;
  }
}
