function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }
  const status = error.status || 500;
  if (status === 500) {
    console.error(error);
  }
  const message = status === 500 ? "Server error" : error.message;
  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
