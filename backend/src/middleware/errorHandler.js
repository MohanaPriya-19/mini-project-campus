function errorHandler(err, req, res, next) {
  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: `Image size must be under ${process.env.IMAGE_MAX_SIZE_MB || 5}MB.`,
    })
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message)
    return res.status(400).json({ success: false, message: messages.join(' ') })
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field'
    return res.status(409).json({ success: false, message: `${field} already exists.` })
  }

  const status = err.status || 500
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again.'
      : err.message || 'Internal server error.'

  if (status === 500) console.error('Unhandled error:', err)

  res.status(status).json({ success: false, message })
}

module.exports = errorHandler
