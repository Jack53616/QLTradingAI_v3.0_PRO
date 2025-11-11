/**
 * Simple logger utility with timestamp and color coding
 */

const LOG_LEVELS = {
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
  DEBUG: "DEBUG"
};

const COLORS = {
  INFO: "\x1b[36m",    // Cyan
  WARN: "\x1b[33m",    // Yellow
  ERROR: "\x1b[31m",   // Red
  DEBUG: "\x1b[35m",   // Magenta
  RESET: "\x1b[0m"
};

function formatTimestamp() {
  return new Date().toISOString();
}

function formatMessage(level, message, data = null) {
  const timestamp = formatTimestamp();
  const color = COLORS[level] || COLORS.RESET;
  const prefix = `${color}[${timestamp}] [${level}]${COLORS.RESET}`;
  
  if (data) {
    return `${prefix} ${message}\n${JSON.stringify(data, null, 2)}`;
  }
  return `${prefix} ${message}`;
}

export function log(message, data = null) {
  console.log(formatMessage(LOG_LEVELS.INFO, message, data));
}

export function warn(message, data = null) {
  console.warn(formatMessage(LOG_LEVELS.WARN, message, data));
}

export function error(message, data = null) {
  console.error(formatMessage(LOG_LEVELS.ERROR, message, data));
}

export function debug(message, data = null) {
  if (process.env.NODE_ENV === "development") {
    console.debug(formatMessage(LOG_LEVELS.DEBUG, message, data));
  }
}

// Export default as log for backward compatibility
export default { log, warn, error, debug };
