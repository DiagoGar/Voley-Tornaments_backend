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

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsConfig = {
  credentials: true,
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
};
app.use(cors(corsConfig));
app.options('*', cors(corsConfig));

app.use(express.json())
app.use(cookieParser())

connectDB().catch((err) => {
  console.error('MongoDB connection failed:', err);
});

app.use('/api/categories', categoriesRouter);
app.use('/api/series', seriesRouter);
app.use('/api/teams', teamRouter);
app.use('/api/matches', matchRouter);
app.use('/api/standings', standingRouter);
app.use('/api/fixture/', fixture)
app.use('/api/tournaments', tournament)
app.use('/api/auth', auth)

module.exports = app;
