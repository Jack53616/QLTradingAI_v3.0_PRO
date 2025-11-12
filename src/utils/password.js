let bcryptInstance = null;

async function loadBcrypt() {
  if (bcryptInstance) return bcryptInstance;
  try {
    const mod = await import("bcryptjs");
    bcryptInstance = mod.default || mod;
  } catch (error) {
    throw new Error("bcrypt_module_missing");
  }
  return bcryptInstance;
}

const SALT_ROUNDS = 10;

export async function hashPassword(plainPassword) {
  if (!plainPassword || plainPassword.length < 6) {
    throw new Error("password_too_short");
  }
  const bcrypt = await loadBcrypt();
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword, hash) {
  if (!hash) return false;
  const bcrypt = await loadBcrypt();
  return bcrypt.compare(plainPassword, hash);
}
