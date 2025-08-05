const express = require('express');
const router = express.Router();
const Serie = require('../models/Serie');

router.get('/', async (req, res) => {
  const series = await Serie.find().populate('category');
  res.json(series);
});

router.post('/', async (req, res) => {
  const serie = new Serie(req.body);
  await serie.save();
  res.status(201).json(serie);
});

module.exports = router;
