const express = require("express");
const router = express.Router();
const Match = require("../models/Match");
const Standing = require("../models/Standing");
const Serie = require("../models/Serie");
const Team = require("../models/Team");
const Tournament = require("../models/Tournament");

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

// GET matches con filtro por torneo
router.get("/", async (req, res) => {
  try {
    const { tournamentId, serieId } = req.query;

    const filter = {};
    if (tournamentId) filter.tournament = tournamentId;
    if (serieId) filter.serie = serieId;

    const matches = await Match.find(filter).populate([
      "teamA",
      "teamB",
      "serie",
      "tournament",
      "winner",
    ]);

    res.json(matches);
  } catch (error) {
    console.error("Error al obtener partidos:", error);
    res.status(500).json({ error: "Error al obtener partidos" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { teamA, teamB, serie, tournament, result } = req.body;
    if (torneo.status === "closed") {
      return res.status(403).json({
        error: "El torneo está finalizado. No se permiten más cambios.",
      });
    }

    if (!teamA || !teamB || !serie || !tournament || !result) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    const { pointsA, pointsB } = result;

    // Validar que los equipos pertenecen al torneo
    const torneo = await Tournament.findById(tournament).populate("teams");
    if (!torneo) {
      return res.status(404).json({ error: "Torneo no encontrado" });
    }

    const teamIds = torneo.teams.map((t) => t._id.toString());

    if (!teamIds.includes(teamA) || !teamIds.includes(teamB)) {
      return res
        .status(400)
        .json({ error: "Los equipos no pertenecen a este torneo" });
    }

    // Crear partido
    const match = new Match({
      teamA,
      teamB,
      serie,
      tournament,
      result: { pointsA, pointsB },
      winner: pointsA > pointsB ? teamA : teamB,
    });

    await match.save();

    // Vincular el partido al torneo
    torneo.matches.push(match._id);
    await torneo.save();

    // 🔹 Actualizar Standing en el contexto del torneo
    const updateStanding = async (
      teamId,
      pointsFor,
      pointsAgainst,
      isWinner
    ) => {
      let standing = await Standing.findOne({
        team: teamId,
        serie,
        tournament,
      });

      if (!standing) {
        standing = new Standing({
          team: teamId,
          serie,
          tournament,
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

// Avanzar a la siguiente fase de un torneo
router.post("/next-round/:tournamentId", async (req, res) => {
  try {
    const { tournamentId } = req.params;

    // Traer torneo con categoría
    const tournament = await Tournament.findById(tournamentId).populate(
      "category"
    );
    if (!tournament) {
      return res.status(404).json({ error: "Torneo no encontrado" });
    }

    if (tournament.status === "closed") {
    return res.status(403).json({
      error: "El torneo está finalizado. No se permiten más cambios.",
    });
  }

    // Todas las series del torneo
    const allSeries = await Serie.find({ tournament: tournamentId }).sort({
      _id: 1,
    });
    if (!allSeries.length) {
      return res.status(404).json({ error: "No hay series para este torneo" });
    }

    const elimSeries = allSeries.filter((s) => isEliminationName(s.name));
    const groupSeries = allSeries.filter((s) => !isEliminationName(s.name));

    // ===== CASO 1: aún NO hay eliminatorias -> crear primera fase
    if (elimSeries.length === 0) {
      // Verificar que todas las series regulares estén cerradas
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

      // Tomar campeones de cada serie
      const winners = [];
      for (const serie of groupSeries) {
        const st = await Standing.find({ serie: serie._id });
        if (!st.length) continue;
        st.sort(sortStandings);
        winners.push(st[0].team);
      }

      const uniqueWinners = [...new Set(winners.map((id) => id.toString()))];
      if (uniqueWinners.length < 2) {
        if (uniqueWinners.length === 1) {
          return res.json({
            message: "Torneo finalizado. Campeón encontrado",
            champion: uniqueWinners[0],
          });
        }
        return res.status(400).json({ error: "No hay suficientes campeones" });
      }

      const nuevaSerie = await Serie.create({
        name: uniqueWinners.length === 2 ? "Final" : "Finales",
        tournament: tournamentId,
        category: tournament.category,
        autoQualified: [], // inicializamos
      });

      await Team.updateMany(
        { _id: { $in: uniqueWinners } },
        { serie: nuevaSerie._id }
      );

      // Crear standings
      for (const teamId of uniqueWinners) {
        await Standing.create({
          team: teamId,
          serie: nuevaSerie._id,
          tournament: tournamentId,
          category: tournament.category,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          points: 0,
        });
      }

      // Fixture con bye
      const createdMatches = [];
      const autoWinners = [];

      for (let i = 0; i < uniqueWinners.length; i += 2) {
        if (i + 1 < uniqueWinners.length) {
          const m = await Match.create({
            teamA: uniqueWinners[i],
            teamB: uniqueWinners[i + 1],
            serie: nuevaSerie._id,
            tournament: tournamentId,
          });
          createdMatches.push(m._id);
        } else {
          autoWinners.push(uniqueWinners[i]); // ⬅️ guardamos bye
        }
      }

      nuevaSerie.autoQualified = autoWinners;
      await nuevaSerie.save();

      return res.json({
        message: `Serie "${nuevaSerie.name}" creada`,
        addedTeams: uniqueWinners.length,
        createdMatches,
        autoQualified: autoWinners,
      });
    }

    // ===== CASO 2: ya hay eliminatorias -> avanzar ronda
    const currentElim = elimSeries[elimSeries.length - 1];
    const matches = await Match.find({
      serie: currentElim._id,
      tournament: tournamentId,
    });

    if (!matches.length) {
      return res
        .status(400)
        .json({ error: `No hay partidos en "${currentElim.name}"` });
    }
    if (matches.some((m) => !m.winner)) {
      return res.status(400).json({
        error: `No todos los partidos de "${currentElim.name}" están finalizados`,
      });
    }

    // Ganadores
    const winners = matches.map((m) => m.winner.toString());

    // Traer standings
    const standings = await Standing.find({
      serie: currentElim._id,
      tournament: tournamentId,
    });
    const equiposIds = standings.map((s) => s.team.toString());

    // Equipos que jugaron realmente
    const playedTeams = matches.flatMap((m) => [
      m.teamA.toString(),
      m.teamB.toString(),
    ]);

    // Recuperar los byes guardados
    const byeTeams =
      currentElim.autoQualified?.map((id) => id.toString()) || [];

    // Los que avanzan = ganadores + byes
    const allQualified = [...new Set([...winners, ...byeTeams])];

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
      tournament: tournamentId,
      category: tournament.category,
      autoQualified: [],
    });

    await Team.updateMany(
      { _id: { $in: allQualified } },
      { serie: nuevaSerie._id }
    );

    // Crear standings
    for (const teamId of allQualified) {
      await Standing.create({
        team: teamId,
        serie: nuevaSerie._id,
        tournament: tournamentId,
        category: tournament.category,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        points: 0,
      });
    }

    // Fixture con bye
    const createdMatches = [];
    const autoWinners = [];

    for (let i = 0; i < allQualified.length; i += 2) {
      if (i + 1 < allQualified.length) {
        const m = await Match.create({
          teamA: allQualified[i],
          teamB: allQualified[i + 1],
          serie: nuevaSerie._id,
          tournament: tournamentId,
        });
        createdMatches.push(m._id);
      } else {
        autoWinners.push(allQualified[i]);
      }
    }

    nuevaSerie.autoQualified = autoWinners;
    await nuevaSerie.save();

    res.json({
      message: `Serie "${nextSerieName}" creada`,
      addedTeams: allQualified.length,
      createdMatches,
      autoQualified: autoWinners,
    });
  } catch (error) {
    console.error("Error en next-round:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const matchId = req.params.id;
    const { teamA, teamB, serie, tournament, result } = req.body;

    if (!teamA || !teamB || !serie || !tournament || !result) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    if (result.pointsA === result.pointsB) {
      return res.status(400).json({ error: "No puede haber empate en vóley" });
    }

    // 1) Actualizar el partido
    const existingMatch = await Match.findById(matchId);
    if (!existingMatch) {
      return res.status(404).json({ error: "Partido no encontrado" });
    }

    // Validar que los equipos pertenezcan al torneo
    const torneo = await Tournament.findById(tournament);
    if (torneo.status === "closed") {
      return res.status(403).json({
        error: "El torneo está finalizado. No se permiten más cambios.",
      });
    }
    if (!torneo) {
      return res.status(404).json({ error: "Torneo no encontrado" });
    }
    if (!torneo.teams.includes(teamA) || !torneo.teams.includes(teamB)) {
      return res
        .status(400)
        .json({ error: "Uno o ambos equipos no pertenecen a este torneo" });
    }

    // Actualizar partido
    existingMatch.teamA = teamA;
    existingMatch.teamB = teamB;
    existingMatch.serie = serie;
    existingMatch.tournament = tournament;
    existingMatch.result = result;
    existingMatch.winner = result.pointsA > result.pointsB ? teamA : teamB;
    await existingMatch.save();

    // Recalcular standings de la serie dentro del torneo
    const matches = await Match.find({ serie, tournament });
    await Standing.deleteMany({ serie, tournament });

    for (const match of matches) {
      if (!match.result) continue; // partidos aún sin resultado

      const teamAStanding =
        (await Standing.findOne({ team: match.teamA, serie, tournament })) ||
        new Standing({
          team: match.teamA,
          serie,
          tournament,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          points: 0,
        });

      const teamBStanding =
        (await Standing.findOne({ team: match.teamB, serie, tournament })) ||
        new Standing({
          team: match.teamB,
          serie,
          tournament,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          points: 0,
        });

      // Actualizar estadísticas
      teamAStanding.matchesPlayed += 1;
      teamBStanding.matchesPlayed += 1;

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

    res.json({
      message: "Partido actualizado y standings recalculados correctamente",
    });
  } catch (err) {
    console.error("Error actualizando partido:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

module.exports = router;
