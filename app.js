const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const categoriesRouter = require('./routes/categoryRoutes')
const seriesRouter = require('./routes/seriesRoutes');
const teamRouter = require('./routes/teamRoutes');
const matchRouter = require('./routes/matchRoutes');
const standingRouter = require('./routes/standingRoutes');
const fixture = require('./routes/fixtureRoutes')

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

app.use('/api/categories', categoriesRouter);
app.use('/api/series', seriesRouter);
app.use('/api/teams', teamRouter);
app.use('/api/matches', matchRouter);
app.use('/api/standings', standingRouter);
app.use('/api/fixture/', fixture)

module.exports = app;
