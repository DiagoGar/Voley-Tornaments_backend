const express = require("express");
const router = express.Router();
const Team = require("../models/Team");
const Tournament = require("../models/Tournament");
const Serie = require("../models/Serie");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/", authMiddleware, async (req, res) => {
  try {
    const { tournamentId } = req.query;

    const query = tournamentId ? { tournament: tournamentId } : {};

    const teams = await Team.find(query)
      .populate("category")
      .populate("serie")
      .populate("tournament");

    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, players, category, serie, tournament } = req.body;

    if (!name || !category || !serie || !tournament) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    // Verificar que el torneo existe
    const torneo = await Tournament.findById(tournament);
    if (!torneo) {
      return res.status(404).json({ error: "Torneo no encontrado" });
    }

    if (torneo.status === "closed") {
      return res
        .status(403)
        .json({
          error: "El torneo está finalizado. No se permiten más cambios.",
        });
    }

    // Verificar que la serie existe y pertenece al torneo
    const serieData = await Serie.findById(serie);
    if (!serieData) {
      return res.status(404).json({ error: "Serie no encontrada" });
    }
    if (String(serieData.tournament) !== String(tournament)) {
      return res.status(400).json({
        error: "La serie no pertenece al torneo seleccionado",
      });
    }

    // Crear equipo
    const team = new Team({
      name,
      players,
      category,
      serie,
      tournament,
    });

    await team.save();

    // Vincular al torneo
    await Tournament.findByIdAndUpdate(
      tournament,
      { $addToSet: { teams: team._id } }, // evita duplicados
      { new: true }
    );

    // Devolver equipo populado
    const populatedTeam = await Team.findById(team._id)
      .populate("tournament", "name")
      .populate("category", "name")
      .populate("serie", "name");

    res.status(201).json(populatedTeam);
  } catch (error) {
    console.error("Error al crear equipo:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    await Team.findByIdAndDelete(req.params.id);
    res.json({ message: "Equipo eliminado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
