import bcrypt from "bcryptjs";

/* ADR-005: bcryptjs cost 12 behind this wrapper — swapping to argon2 later is a
   one-file change. */

const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
