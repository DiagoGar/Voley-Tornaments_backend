const express = require("express");
const router = express.Router();
const Match = require("../models/Match");
const Standing = require("../models/Standing");

router.get("/", async (req, res) => {
  const matches = await Match.find().populate([
    "teamA",
    "teamB",
    "serie",
    "winner",
  ]);
  res.json(matches);
});

router.post("/", async (req, res) => {
  try {
    const { teamA, teamB, serie, result } = req.body;

    if (!teamA || !teamB || !serie || !result) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    const { pointsA, pointsB } = result;

    const match = new Match({
      teamA,
      teamB,
      serie,
      result: { pointsA, pointsB },
      winner: pointsA > pointsB ? teamA : teamB,
    });

    await match.save();

    const updateStanding = async (
      teamId,
      pointsFor,
      pointsAgainst,
      isWinner
    ) => {
      let standing = await Standing.findOne({ team: teamId });

      if (!standing) {
        standing = new Standing({
          team: teamId,
          serie: null,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          points: 0,
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
    console.error("Error al registrar partido:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const matchId = req.params.id;
    const { teamA, teamB, serie, result } = req.body;

    if (!teamA || !teamB || !serie || !result) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    if (result.pointsA === result.pointsB) {
      return res.status(400).json({ error: 'No puede haber empate en vóley' });
    }

    const existingMatch = await Match.findById(matchId);
    if (!existingMatch) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    existingMatch.teamA = teamA;
    existingMatch.teamB = teamB;
    existingMatch.serie = serie;
    existingMatch.result = result;
    existingMatch.winner = result.pointsA > result.pointsB ? teamA : teamB;
    await existingMatch.save();

    const matches = await Match.find({ serie });
    await Standing.deleteMany({ serie });

    for (const match of matches) {
      const teamAStanding = await Standing.findOne({ team: match.teamA, serie }) 
        || new Standing({ team: match.teamA, serie, matchesPlayed: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, points: 0 });

      const teamBStanding = await Standing.findOne({ team: match.teamB, serie }) 
        || new Standing({ team: match.teamB, serie, matchesPlayed: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, points: 0 });

      teamAStanding.matchesPlayed += 1;
      teamBStanding.matchesPlayed += 1;

      teamAStanding.pointsFor += match.result.pointsA;
      teamAStanding.pointsAgainst += match.result.pointsB;

      teamBStanding.pointsFor += match.result.pointsB;
      teamBStanding.pointsAgainst += match.result.pointsA;

      if (match.result.pointsA > match.result.pointsB) {
        teamAStanding.wins += 1;
        teamAStanding.points += 3;
        teamBStanding.losses += 1;
        teamBStanding.points += 1;
      } else {
        teamBStanding.wins += 1;
        teamBStanding.points += 3;
        teamAStanding.losses += 1;
        teamAStanding.points += 1;
      }

      await teamAStanding.save();
      await teamBStanding.save();
    }

    res.json({ message: 'Partido actualizado y standings recalculados correctamente' });

  } catch (err) {
    console.error('Error actualizando partido:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});


// router.put('/:id', async (req, res) => {
//   try {
//     const matchId = req.params.id;
//     const { teamA, teamB, serie, result } = req.body;

//     if (!teamA || !teamB || !serie || !result) {
//       return res.status(400).json({ error: 'Faltan datos obligatorios' });
//     }

//     const existingMatch = await Match.findById(matchId);
//     if (!existingMatch) {
//       return res.status(404).json({ error: 'Partido no encontrado' });
//     }

//     // 1. Revertir standings anteriores
//     const revertStanding = async (teamId, pointsFor, pointsAgainst, wasWinner) => {
//       const standing = await Standing.findOne({ team: teamId });
//       if (standing) {
//         standing.matchesPlayed -= 1;
//         standing.pointsFor -= pointsFor;
//         standing.pointsAgainst -= pointsAgainst;

//         if (wasWinner) {
//           standing.wins -= 1;
//           standing.points -= 3;
//         } else {
//           standing.losses -= 1;
//           standing.points -= 1;
//         }

//         await standing.save();
//       }
//     };

//     const oldPointsA = existingMatch.result.pointsA;
//     const oldPointsB = existingMatch.result.pointsB;
//     const oldWinner = oldPointsA > oldPointsB ? existingMatch.teamA.toString() : existingMatch.teamB.toString();

//     await revertStanding(existingMatch.teamA, oldPointsA, oldPointsB, oldWinner === existingMatch.teamA.toString());
//     await revertStanding(existingMatch.teamB, oldPointsB, oldPointsA, oldWinner === existingMatch.teamB.toString());

//     // 2. Actualizar el partido
//     existingMatch.teamA = teamA;
//     existingMatch.teamB = teamB;
//     existingMatch.serie = serie;
//     existingMatch.result = result;
//     existingMatch.winner = result.pointsA > result.pointsB ? teamA : teamB;
//     await existingMatch.save();

//     // 3. Aplicar nuevo resultado a standings
//     const applyStanding = async (teamId, pointsFor, pointsAgainst, isWinner) => {
//       let standing = await Standing.findOne({ team: teamId });

//       if (!standing) {
//         standing = new Standing({
//           team: teamId,
//           serie,
//           matchesPlayed: 0,
//           wins: 0,
//           losses: 0,
//           pointsFor: 0,
//           pointsAgainst: 0,
//           points: 0,
//         });
//       }

//       standing.matchesPlayed += 1;
//       standing.pointsFor += pointsFor;
//       standing.pointsAgainst += pointsAgainst;

//       if (isWinner) {
//         standing.wins += 1;
//         standing.points += 3;
//       } else {
//         standing.losses += 1;
//         standing.points += 1;
//       }

//       await standing.save();
//     };

//     await applyStanding(teamA, result.pointsA, result.pointsB, result.pointsA > result.pointsB);
//     await applyStanding(teamB, result.pointsB, result.pointsA, result.pointsB > result.pointsA);

//     res.json({ message: 'Partido actualizado correctamente' });

//   } catch (err) {
//     console.error('Error actualizando partido:', err);
//     res.status(500).json({ error: 'Error del servidor' });
//   }
// });

module.exports = router;
