const multer = require('multer')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

const MAX_SIZE = parseFloat(process.env.IMAGE_MAX_SIZE_MB || '5') * 1024 * 1024
const ALLOWED = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/jpg')
  .split(',')
  .map((t) => t.trim())

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${uuidv4()}${ext}`)
  },
})

function fileFilter(req, file, cb) {
  if (ALLOWED.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`Invalid file type. Allowed: ${ALLOWED.join(', ')}`), false)
  }
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } })

module.exports = upload
