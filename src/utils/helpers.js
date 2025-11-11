/**
 * Utility helper functions
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize user input to prevent XSS
 * @param {string} input - User input
 * @returns {string}
 */
export function sanitizeInput(input) {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(/[<>]/g, "")
    .trim()
    .substring(0, 1000); // Limit length
}

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @returns {string}
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
}

/**
 * Check if subscription is active
 * @param {Date|string} expiryDate - Subscription expiry date
 * @returns {boolean}
 */
export function isSubscriptionActive(expiryDate) {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  return expiry > new Date();
}

/**
 * Generate random string
 * @param {number} length - Length of string
 * @returns {string}
 */
export function generateRandomString(length = 8) {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length)
    .toUpperCase();
}

/**
 * Sleep/delay function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate positive number
 * @param {any} value - Value to check
 * @returns {boolean}
 */
export function isPositiveNumber(value) {
  const num = Number(value);
  return !isNaN(num) && num > 0;
}
