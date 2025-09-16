const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');


router.get('/', async (req, res) => {
  try {
    const { tournamentId } = req.query;

    const query = tournamentId ? { tournament: tournamentId } : {};

    const teams = await Team.find(query)
      .populate('category')
      .populate('serie')
      .populate('tournament');

    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, players, category, serie, tournament } = req.body;

    if (!name || !category || !serie || !tournament) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    // Crear equipo
    const team = new Team({ name, players, category, serie, tournament });
    await team.save();

    // Vincular al torneo
    await Tournament.findByIdAndUpdate(
      tournament,
      { $addToSet: { teams: team._id } }, // evita duplicados
      { new: true }
    );

    res.status(201).json(team);
  } catch (error) {
    console.error("Error al crear equipo:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


router.delete('/:id', async (req, res) => {
  try {
    await Team.findByIdAndDelete(req.params.id);
    res.json({ message: 'Equipo eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
