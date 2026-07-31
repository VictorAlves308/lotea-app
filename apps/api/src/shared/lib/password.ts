import bcrypt from 'bcryptjs';

// 12 rounds is bcrypt's commonly recommended floor for 2026-era hardware —
// slow enough to resist brute-forcing, fast enough not to bottleneck login.
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
