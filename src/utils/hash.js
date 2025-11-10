import crypto from "crypto";

export function hashKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}
