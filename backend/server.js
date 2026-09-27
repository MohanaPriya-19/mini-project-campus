const path = require('path')
const dotenv = require('dotenv')

// Load this backend's .env independent of Node's working directory.
const envResult = dotenv.config({ path: path.join(__dirname, '.env'), override: true })
if (envResult.error && envResult.error.code !== 'ENOENT') throw envResult.error
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const dns = require('dns')

// The active Windows DNS resolver does not answer Atlas SRV lookups. Configure
// Node's resolver before Mongoose (and therefore the MongoDB driver) loads.
dns.setServers(['8.8.8.8', '1.1.1.1'])

const connectDB = require('./src/config/db')
const routes = require('./src/routes/index')
const authRoutes = require('./src/routes/auth')
const complaintRoutes = require('./src/routes/complaints')
const errorHandler = require('./src/middleware/errorHandler')
const { startOverdueCron } = require('./src/services/overdueCron')

const app = express()

// Security headers
// The admin/staff Vite app runs on a different local port from Express.
const publicBackendOrigins = [
  `http://localhost:${process.env.PORT || 5001}`,
  `http://127.0.0.1:${process.env.PORT || 5001}`,
]
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      imgSrc: ["'self'", 'data:', ...publicBackendOrigins],
    },
  },
}))

// CORS — allow admin UI and mobile dev origins
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map((o) => o.trim())

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))

// Rate limiting on auth endpoints
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { success: false, message: 'Too many requests. Please try again later.' } }))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}

// Serve uploaded evidence images. Helmet's default CORP header is same-origin,
// which prevents the browser at the admin portal origin (port 5173) from
// rendering a valid file from this backend (port 5001). Override it only for
// this public image route; API responses retain Helmet's default protection.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
}))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/complaints', complaintRoutes)
app.use('/api', routes)

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', project: 'campus-grievance-new' }))

// 404
app.use((req, res) => res.status(404).json({ success: false, message: 'Endpoint not found.' }))

// Global error handler
app.use(errorHandler)

const PORT = process.env.PORT || 5001

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`NEW Campus Grievance Backend running on port ${PORT}`)
      startOverdueCron()
    })
  })
  .catch((err) => {
    // Never print the URI: it contains the Atlas password.
    console.error(err.message)
    process.exitCode = 1
  })
