const express = require("express");
const router = express.Router();
const Match = require("../models/Match");
const Standing = require("../models/Standing");
const Serie = require("../models/Serie");
const Team = require("../models/Team");

//helper
const isEliminationName = (name = "") =>
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

router.post("/next-round/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Todas las series de la categoría
    const allSeries = await Serie.find({ category: categoryId })
      .sort({ _id: 1 })
      .exec();
    if (!allSeries.length) {
      return res
        .status(404)
        .json({ error: "No hay series para esta categoría" });
    }

    const elimSeries = allSeries.filter((s) => isEliminationName(s.name));
    const groupSeries = allSeries.filter((s) => !isEliminationName(s.name));

    // ===== CASO 1: aún NO hay eliminatorias -> unificar campeones de A, B, ...
    if (elimSeries.length === 0) {
      // Verificar que TODAS las series de fase regular estén cerradas
      for (const serie of groupSeries) {
        const openMatch = await Match.findOne({
          serie: serie._id,
          winner: { $exists: false },
        });
        if (openMatch) {
          return res.status(400).json({
            error: `La serie "${serie.name}" aún tiene partidos sin cerrar`,
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

      const uniqueWinners = [...new Set(winners.map((id) => id.toString()))];

      if (uniqueWinners.length < 2) {
        if (uniqueWinners.length === 1) {
          return res.json({
            message: "Torneo finalizado. Campeón encontrado",
            champion: uniqueWinners[0],
          });
        }
        return res.status(400).json({
          error: "No hay suficientes campeones para crear eliminatorias",
        });
      }

      const nuevaSerie = await Serie.create({
        name: uniqueWinners.length === 2 ? "Final" : "Finales",
        category: categoryId,
      });

      await Team.updateMany(
        { _id: { $in: uniqueWinners } },
        { serie: nuevaSerie._id }
      );

      // Crear standings en la nueva serie
      for (const teamId of uniqueWinners) {
        await Standing.create({
          team: teamId,
          serie: nuevaSerie._id,
          category: categoryId,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          points: 0,
        });
      }

      // Generar fixture con lógica de bye
      const createdMatches = [];
      const autoWinners = [];

      for (let i = 0; i < uniqueWinners.length; i += 2) {
        if (i + 1 < uniqueWinners.length) {
          const m = await Match.create({
            teamA: uniqueWinners[i],
            teamB: uniqueWinners[i + 1],
            serie: nuevaSerie._id,
          });
          createdMatches.push(m._id);
        } else {
          autoWinners.push(uniqueWinners[i]);
        }
      }

      return res.json({
        message: `Serie "${nuevaSerie.name}" creada con ${uniqueWinners.length} equipos`,
        addedTeams: uniqueWinners.length,
        createdMatches,
        autoQualified: autoWinners,
      });
    }

    // ===== CASO 2: ya hay eliminatorias -> avanzar dentro de ellas
    const currentElim = elimSeries[elimSeries.length - 1];

    const matches = await Match.find({ serie: currentElim._id });
    if (!matches.length) {
      return res
        .status(400)
        .json({ error: `No hay partidos en "${currentElim.name}"` });
    }
    if (matches.some((m) => !m.winner)) {
      return res
        .status(400)
        .json({
          error: `No todos los partidos de "${currentElim.name}" están finalizados`,
        });
    }

    // Ganadores de los partidos
    const winners = matches.map((m) => m.winner.toString());

    // Standings de esta serie
    const standings = await Standing.find({ serie: currentElim._id });
    const equiposIds = standings.map((s) => s.team.toString());

    // Equipos que efectivamente jugaron esta serie
    const playedTeams = matches.flatMap((m) => [
      m.teamA.toString(),
      m.teamB.toString(),
    ]);

    // Solo pasan los ganadores y los bye (los que no jugaron esta ronda)
    const byeTeams = equiposIds.filter((id) => !playedTeams.includes(id));
    const allQualified = [...new Set([...winners, ...byeTeams])];

    // Si ya queda solo un campeón
    if (allQualified.length === 1) {
      return res.json({
        message: "Torneo finalizado. Campeón encontrado",
        champion: allQualified[0],
      });
    }

    let nextSerieName;
    switch (allQualified.length) {
      case 8:
        nextSerieName = "Cuartos de final";
        break;
      case 4:
        nextSerieName = "Semifinales";
        break;
      case 2:
        nextSerieName = "Final";
        break;
      default:
        nextSerieName = `Ronda ${allQualified.length}`;
    }

    const nuevaSerie = await Serie.create({
      name: nextSerieName,
      category: categoryId,
    });

    await Team.updateMany(
      { _id: { $in: allQualified } },
      { serie: nuevaSerie._id }
    );

    // Crear standings de la nueva serie
    for (const teamId of allQualified) {
      await Standing.create({
        team: teamId,
        serie: nuevaSerie._id,
        category: categoryId,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        points: 0,
      });
    }

    // Generar fixture con lógica de bye
    const createdMatches = [];
    const autoWinners = [];

    for (let i = 0; i < allQualified.length; i += 2) {
      if (i + 1 < allQualified.length) {
        const m = await Match.create({
          teamA: allQualified[i],
          teamB: allQualified[i + 1],
          serie: nuevaSerie._id,
        });
        createdMatches.push(m._id);
      } else {
        autoWinners.push(allQualified[i]);
      }
    }

    res.json({
      message: `Serie "${nextSerieName}" creada con ${allQualified.length} equipos`,
      addedTeams: allQualified.length,
      createdMatches,
      autoQualified: autoWinners,
    });
  } catch (error) {
    console.error("Error en next-round:", error);
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

router.put("/:id", async (req, res) => {
  try {
    const matchId = req.params.id;
    const { teamA, teamB, serie, result } = req.body;

    if (!teamA || !teamB || !serie || !result) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    const pointsA = Number(result.pointsA);
    const pointsB = Number(result.pointsB);

    if (!Number.isFinite(pointsA) || !Number.isFinite(pointsB)) {
      return res.status(400).json({ error: "Puntajes inválidos" });
    }
    if (pointsA === pointsB) {
      return res.status(400).json({ error: "No puede haber empate en vóley" });
    }

    // 1) Actualizar el partido
    const existingMatch = await Match.findById(matchId);
    if (!existingMatch) {
      return res.status(404).json({ error: "Partido no encontrado" });
    }

    existingMatch.teamA = teamA;
    existingMatch.teamB = teamB;
    existingMatch.serie = serie;
    existingMatch.result = { pointsA, pointsB };
    existingMatch.winner = pointsA > pointsB ? teamA : teamB;
    await existingMatch.save();

    // 2) Recalcular standings de TODA la serie sin borrar los existentes
    //    (así preservamos al equipo con bye)
    // 2a) Arrancar de todos los equipos que pertenecen a la serie (incluye los del bye)
    const teamsInSerie = await Team.find({ serie }).select("_id");
    const teamIds = teamsInSerie.map((t) => t._id.toString());

    // 2b) Asegurar también los que aparezcan en partidos (por si acaso)
    const playedMatches = await Match.find({
      serie,
      "result.pointsA": { $exists: true },
      "result.pointsB": { $exists: true },
    }).select("teamA teamB result");

    for (const m of playedMatches) {
      const a = m.teamA.toString();
      const b = m.teamB.toString();
      if (!teamIds.includes(a)) teamIds.push(a);
      if (!teamIds.includes(b)) teamIds.push(b);
    }

    // 2c) Inicializar totales incluyendo equipos sin partidos (bye)
    const totals = {};
    for (const id of teamIds) {
      totals[id] = {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        points: 0,
      };
    }

    // 2d) Acumular con todos los partidos cerrados de la serie
    for (const m of playedMatches) {
      const a = m.teamA.toString();
      const b = m.teamB.toString();
      const aPts = Number(m.result?.pointsA ?? 0);
      const bPts = Number(m.result?.pointsB ?? 0);
      if (!Number.isFinite(aPts) || !Number.isFinite(bPts)) continue;

      totals[a].matchesPlayed += 1;
      totals[b].matchesPlayed += 1;

      totals[a].pointsFor += aPts;
      totals[a].pointsAgainst += bPts;

      totals[b].pointsFor += bPts;
      totals[b].pointsAgainst += aPts;

      if (aPts > bPts) {
        totals[a].wins += 1;
        totals[a].points += 3;
        totals[b].losses += 1;
        totals[b].points += 1;
      } else {
        totals[b].wins += 1;
        totals[b].points += 3;
        totals[a].losses += 1;
        totals[a].points += 1;
      }
    }

    // 2e) Upsert por equipo+serie (NO borrar nada)
    const ops = Object.entries(totals).map(([teamId, s]) => ({
      updateOne: {
        filter: { team: teamId, serie },
        update: { $set: { team: teamId, serie, ...s } },
        upsert: true,
      },
    }));
    await Standing.bulkWrite(ops);

    return res.json({
      message: "Partido actualizado y standings recalculados correctamente",
    });
  } catch (err) {
    console.error("Error actualizando partido:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

module.exports = router;
