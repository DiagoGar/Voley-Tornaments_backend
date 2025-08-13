const express = require("express");
const router = express.Router();
const Match = require("../models/Match");
const Standing = require("../models/Standing");
const Serie = require('../models/Serie');
const Team = require("../models/Team");

//helper
const isEliminationName = (name = '') =>
  /(final|semifinal|cuartos|elimin|ronda)/i.test(name);

const sortStandings = (a, b) => {
  // 1) más victorias
  if (b.wins !== a.wins) return b.wins - a.wins;
  // 2) más puntos
  if (b.points !== a.points) return b.points - a.points;
  // 3) mejor diferencia PF-PC
  const diffA = a.pointsFor - a.pointsAgainst;
  const diffB = b.pointsFor - b.pointsAgainst;
  return diffB - diffA;
};

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

router.post('/next-round/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Todas las series de la categoría
    const allSeries = await Serie.find({ category: categoryId }).sort({ _id: 1 }).exec();
    if (!allSeries.length) {
      return res.status(404).json({ error: 'No hay series para esta categoría' });
    }

    const elimSeries = allSeries.filter(s => isEliminationName(s.name));
    const groupSeries = allSeries.filter(s => !isEliminationName(s.name));

    // ===== CASO 1: aún NO hay eliminatorias -> unificar campeones de A, B, ...
    if (elimSeries.length === 0) {
      // Verificar que TODAS las series de fase regular estén cerradas
      for (const serie of groupSeries) {
        const openMatch = await Match.findOne({ serie: serie._id, winner: { $exists: false } });
        if (openMatch) {
          return res.status(400).json({
            error: `La serie "${serie.name}" aún tiene partidos sin cerrar`
          });
        }
      }

      // Tomar el 1º de cada serie segun standings
      const winners = [];
      for (const serie of groupSeries) {
        const st = await Standing.find({ serie: serie._id });
        if (!st.length) continue;
        st.sort(sortStandings);
        winners.push(st[0].team); // ObjectId del equipo campeón de esa serie
      }

      // Quitar duplicados por si acaso
      const uniqueWinners = [...new Set(winners.map(id => id.toString()))];

      if (uniqueWinners.length < 2) {
        // Si hay 0 o 1 ganadores, no tiene sentido crear eliminatoria
        if (uniqueWinners.length === 1) {
          return res.json({ message: 'Torneo finalizado. Campeón encontrado', champion: uniqueWinners[0] });
        }
        return res.status(400).json({ error: 'No hay suficientes campeones para crear eliminatorias' });
      }

      // Crear serie "Finales" (o "Eliminatorias")
      const nuevaSerie = await Serie.create({
        name: uniqueWinners.length === 2 ? 'Final' : 'Finales',
        category: categoryId
      });

      // Mover equipos ganadores a la nueva serie
      await Team.updateMany(
        { _id: { $in: uniqueWinners } },
        { serie: nuevaSerie._id }
      );

      // Reset/crear standings para la nueva serie (usando tu schema con unique por team)
      for (const teamId of uniqueWinners) {
        await Standing.updateOne(
          { team: teamId }, // 1 único standing por team (se "traslada" de serie)
          {
            $set: {
              team: teamId,
              serie: nuevaSerie._id,
              matchesPlayed: 0,
              wins: 0,
              losses: 0,
              pointsFor: 0,
              pointsAgainst: 0,
              points: 0,
            }
          },
          { upsert: true }
        );
      }

      // Generar fixture por pares
      const createdMatches = [];
      for (let i = 0; i < uniqueWinners.length; i += 2) {
        if (i + 1 < uniqueWinners.length) {
          const m = await Match.create({
            teamA: uniqueWinners[i],
            teamB: uniqueWinners[i + 1],
            serie: nuevaSerie._id
          });
          createdMatches.push(m._id);
        }
      }

      return res.json({
        message: `Serie "${nuevaSerie.name}" creada con ${uniqueWinners.length} equipos`,
        addedTeams: uniqueWinners.length,
        createdMatches
      });
    }

    // ===== CASO 2: ya hay eliminatorias -> avanzar dentro de ellas
    // Tomamos la eliminatoria más reciente
    const currentElim = elimSeries[elimSeries.length - 1];

    // Verificar que todos los partidos de la fase actual estén cerrados
    const matches = await Match.find({ serie: currentElim._id });
    if (!matches.length) {
      return res.status(400).json({ error: `No hay partidos en "${currentElim.name}"` });
    }
    if (matches.some(m => !m.winner)) {
      return res.status(400).json({ error: `No todos los partidos de "${currentElim.name}" están finalizados` });
    }

    // Ganadores de la fase
    const winners = matches.map(m => m.winner.toString());
    const uniqueWinners = [...new Set(winners)];

    if (uniqueWinners.length === 1) {
      return res.json({ message: 'Torneo finalizado. Campeón encontrado', champion: uniqueWinners[0] });
    }

    // Determinar siguiente fase
    let nextSerieName;
    switch (uniqueWinners.length) {
      case 8:
        nextSerieName = 'Cuartos de final';
        break;
      case 4:
        nextSerieName = 'Semifinales';
        break;
      case 2:
        nextSerieName = 'Final';
        break;
      default:
        nextSerieName = `Ronda ${uniqueWinners.length}`;
    }

    const nuevaSerie = await Serie.create({
      name: nextSerieName,
      category: categoryId
    });

    await Team.updateMany(
      { _id: { $in: uniqueWinners } },
      { serie: nuevaSerie._id }
    );

    // Reset/crear standings para la nueva serie
    for (const teamId of uniqueWinners) {
      await Standing.updateOne(
        { team: teamId },
        {
          $set: {
            team: teamId,
            serie: nuevaSerie._id,
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            pointsFor: 0,
            pointsAgainst: 0,
            points: 0,
          }
        },
        { upsert: true }
      );
    }

    const createdMatches = [];
    for (let i = 0; i < uniqueWinners.length; i += 2) {
      if (i + 1 < uniqueWinners.length) {
        const m = await Match.create({
          teamA: uniqueWinners[i],
          teamB: uniqueWinners[i + 1],
          serie: nuevaSerie._id
        });
        createdMatches.push(m._id);
      }
    }

    res.json({
      message: `Serie "${nextSerieName}" creada con ${uniqueWinners.length} equipos`,
      addedTeams: uniqueWinners.length,
      createdMatches
    });

  } catch (error) {
    console.error('Error en next-round:', error);
    res.status(500).json({ error: error.message });
  }
});

// router.post('/finales/:categoryId', async (req, res) => {
//   try {
//     const { categoryId } = req.params;

//     // Buscar todas las series de esta categoría
//     const series = await Serie.find({ category: categoryId });

//     if (!series.length) {
//       return res.status(404).json({ error: 'No se encontraron series para esta categoría' });
//     }

//     let winners = [];

//     // Obtener el primer lugar de cada serie
//     for (const serie of series) {
//       const posiciones = await calcularPosiciones(serie._id);
//       if (posiciones.length > 0) {
//         winners.push(posiciones[0].teamId); // Solo primer lugar
//       }
//     }

//     if (winners.length < 2) {
//       return res.status(400).json({ error: 'No hay suficientes ganadores para generar finales' });
//     }
    
//     const nuevaSerie = await Serie.create({
//       name: 'Finales',
//       category: categoryId
//     });

//     await Promise.all(
//       winners.map(teamId =>
//         Team.updateOne({ _id: teamId }, { serie: nuevaSerie._id })
//       )
//     );

//     await generarFixture(nuevaSerie._id);

//     res.status(200).json({
//       message: 'Finales creadas correctamente',
//       nuevaSerieId: nuevaSerie._id,
//       addedTeams: winners.length
//     });

//   } catch (error) {
//     console.error('Error en /finales:', error);
//     res.status(500).json({ error: error.message });
//   }
// });


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

module.exports = router;
