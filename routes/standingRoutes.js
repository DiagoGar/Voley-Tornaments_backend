const express = require('express');
const router = express.Router();
const Standing = require('../models/Standing');

router.get('/', async (req, res) => {
  try {
    const standings = await Standing.find()
      .populate('team')
      .populate({
        path: 'serie',
        populate: { path: 'category' }
      });

    res.json(standings);
  } catch (error) {
    console.error('Error al obtener standings:', error);
    res.status(500).json({ error: 'Error al obtener standings' });
  }
});

router.post('/', async (req, res) => {
  const standing = new Standing(req.body);
  await standing.save();
  res.status(201).json(standing);
});

module.exports = router;
