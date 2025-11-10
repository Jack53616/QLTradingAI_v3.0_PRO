export function daysLeft(expiration) {
  if (!expiration) return 0;
  const now = new Date();
  const exp = new Date(expiration);
  const diff = exp - now;
  return Math.max(Math.floor(diff / (1000 * 60 * 60 * 24)), 0);
}
