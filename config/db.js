const mongoose = require('mongoose')
require('dotenv').config()

mongoose.set('bufferCommands', false);

let cachedConnection = null;
let connectionPromise = null;

const connectDB = async () => {
  if (cachedConnection || mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  connectionPromise = mongoose
    .connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    })
    .then((connection) => {
      cachedConnection = connection;
      console.log('MongoDB connected');
      return connection;
    })
    .catch((error) => {
      console.error('Error connecting to MongoDB:', error);
      throw error;
    })
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
};

module.exports = connectDB;
