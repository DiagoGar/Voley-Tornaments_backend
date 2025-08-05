const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Standing = require('../models/Standing')

router.get('/', async (req, res) => {
  const matches = await Match.find().populate(['teamA', 'teamB', 'serie', 'winner']);
  res.json(matches);
});

router.post('/', async (req, res) => {
  try {
    const { teamA, teamB, serie, result } = req.body;

    if (!teamA || !teamB || !serie || !result) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    const { pointsA, pointsB } = result;

    const match = new Match({
      teamA,
      teamB,
      serie,
      result: { pointsA, pointsB },
      winner: pointsA > pointsB ? teamA : teamB
    });

    await match.save();

    const updateStanding = async (teamId, pointsFor, pointsAgainst, isWinner) => {
      let standing = await Standing.findOne({ team: teamId });

      if (!standing) {
        standing = new Standing({
          team: teamId,
          serie,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          points: 0
        });
      }

      standing.matchesPlayed += 1;
      standing.pointsFor += pointsFor;
      standing.pointsAgainst += pointsAgainst;

      if (isWinner) {
        standing.wins += 1;
        standing.points += 3;
      } else {
        standing.losses += 1;
        standing.points += 1;
      }

      await standing.save();
    };

    await updateStanding(teamA, pointsA, pointsB, pointsA > pointsB);
    await updateStanding(teamB, pointsB, pointsA, pointsB > pointsA);

    res.status(201).json(match);
  } catch (err) {
    console.error('Error al registrar partido:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


module.exports = router;
