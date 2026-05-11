const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const cookieParser = require("cookie-parser")

const categoriesRouter = require('./routes/categoryRoutes')
const seriesRouter = require('./routes/seriesRoutes');
const teamRouter = require('./routes/teamRoutes');
const matchRouter = require('./routes/matchRoutes');
const standingRouter = require('./routes/standingRoutes');
const fixture = require('./routes/fixtureRoutes')
const tournament = require('./routes/tournamentRoutes')
const auth = require('./routes/auth')

const app = express();

const defaultOrigins = [
  'https://voley-tornaments.vercel.app',
  'http://localhost:3000',
];

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const originSet = new Set([...defaultOrigins, ...allowedOrigins]);

const corsConfig = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (originSet.has(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
};
app.use(cors(corsConfig));
app.options(/.*/, cors(corsConfig));

app.use(express.json())
app.use(cookieParser())

app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    return next();
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

app.use('/api/categories', categoriesRouter);
app.use('/api/series', seriesRouter);
app.use('/api/teams', teamRouter);
app.use('/api/matches', matchRouter);
app.use('/api/standings', standingRouter);
app.use('/api/fixture/', fixture)
app.use('/api/tournaments', tournament)
app.use('/api/auth', auth)

app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS origin not allowed' });
  }

  return next(err);
});

module.exports = app;
