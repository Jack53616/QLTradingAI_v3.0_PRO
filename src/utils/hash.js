import crypto from "crypto";

/**
 * Hash a key using SHA-256
 * @param {string} key - The plain text key to hash
 * @returns {string} - The hashed key in hex format
 */
export function hashKey(key) {
  if (!key || typeof key !== "string") {
    throw new Error("Invalid key: must be a non-empty string");
  }
  return crypto.createHash("sha256").update(key.trim()).digest("hex");
}

/**
 * Verify a plain key against a hashed key
 * @param {string} plainKey - The plain text key
 * @param {string} hashedKey - The hashed key to compare against
 * @returns {boolean} - True if keys match
 */
export function verifyKey(plainKey, hashedKey) {
  try {
    return hashKey(plainKey) === hashedKey;
  } catch {
    return false;
  }
}
