const mongoose = require('mongoose')

const connectDB = async () => {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Add the NEW Atlas URI to backend/.env.')
  }
  let databaseName
  try {
    const parsed = new URL(uri)
    if (parsed.protocol !== 'mongodb+srv:' && parsed.protocol !== 'mongodb:') throw new Error('unsupported protocol')
    databaseName = parsed.pathname.slice(1)
    if (!databaseName) throw new Error('database name missing')
  } catch {
    throw new Error('MONGODB_URI is malformed. Use a MongoDB Atlas mongodb+srv URI.')
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 15000) })
    console.log('MongoDB connected successfully (database: ' + (mongoose.connection.name || databaseName) + ')')
  } catch (err) {
    if (err?.message?.includes('querySrv') || err?.code === 'ECONNREFUSED' || err?.code === 'ETIMEOUT') {
      throw new Error('MongoDB Atlas SRV DNS lookup failed. The Node.js DNS resolver must resolve the Atlas SRV record.')
    }
    throw new Error('MongoDB connection failed: ' + err.message)
  }
}

module.exports = connectDB
