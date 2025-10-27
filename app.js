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

const corsConfig = {
    credentials: true,
    origin: true,
};
app.use(cors(corsConfig));

app.use(express.json())
app.use(cookieParser())

connectDB();

app.use('/api/categories', categoriesRouter);
app.use('/api/series', seriesRouter);
app.use('/api/teams', teamRouter);
app.use('/api/matches', matchRouter);
app.use('/api/standings', standingRouter);
app.use('/api/fixture/', fixture)
app.use('/api/tournaments', tournament)
app.use('/api/auth', auth)

module.exports = app;
