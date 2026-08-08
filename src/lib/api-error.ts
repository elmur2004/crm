/* Typed API error thrown by guards and services; handleRoute maps it to JSON.
   Lives outside lib/auth so services and tests never import the NextAuth runtime. */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
