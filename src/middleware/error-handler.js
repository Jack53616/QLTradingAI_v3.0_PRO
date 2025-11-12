export function notFoundHandler(_req, res) {
  res.status(404).json({ success: false, message: "not_found" });
}

export function errorHandler(err, _req, res, _next) {
  const message = err?.message === "bcrypt_module_missing"
    ? "bcrypt_dependency_missing"
    : err?.message || "Error";

  const payload = {
    success: false,
    message
  };

  if (process.env.NODE_ENV !== "production" && err?.stack) {
    payload.stack = err.stack;
  }

  res.status(err?.statusCode || 500).json(payload);
}
