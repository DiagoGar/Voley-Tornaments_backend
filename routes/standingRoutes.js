const express = require('express');
const router = express.Router();
const Standing = require('../models/Standing');

router.get('/', async (req, res) => {
  const standings = await Standing.find().populate(['team', 'serie']);
  res.json(standings);
});

router.post('/', async (req, res) => {
  const standing = new Standing(req.body);
  await standing.save();
  res.status(201).json(standing);
});

module.exports = router;
