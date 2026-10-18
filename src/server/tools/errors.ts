/** A lookup that failed in a way the visitor should see (no records, DNS timeout...), with its HTTP status. */
export class ToolError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: number,
    message: string,
  ) {
    super(message);
  }
}
