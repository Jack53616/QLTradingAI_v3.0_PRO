import crypto from "crypto";

export function verifyTelegramInitData(initData, botToken) {
  const parsed = new URLSearchParams(initData);
  const hash = parsed.get("hash");
  parsed.delete("hash");
  const dataCheckString = Array.from(parsed.entries())
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const checkHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return hash === checkHash;
}
