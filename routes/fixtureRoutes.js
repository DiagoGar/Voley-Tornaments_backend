// routes/fixtureRoutes.js
const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Match = require('../models/Match');

router.post('/generate', async (req, res) => {
  const { serieId } = req.body;

  try {
    const teams = await Team.find({ serie: serieId });

    if (teams.length < 2) {
      return res.status(400).json({ error: 'Se necesitan al menos 2 equipos' });
    }

    const matches = [];

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          teamA: teams[i]._id,
          teamB: teams[j]._id,
          serie: serieId,
          result: { pointsA: 0, pointsB: 0 }, // Inicial vacío
        });
      }
    }

    await Match.insertMany(matches);

    res.status(201).json({ message: 'Fixture generado con éxito', count: matches.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar fixture' });
  }
});

module.exports = router;
