const express = require('express');
const router = express.Router();
const Serie = require('../models/Serie');
const Tournament = require('../models/Tournament');


router.get('/', async (req, res) => {
  try {
    const { tournamentId } = req.query;
    const query = tournamentId ? { tournament: tournamentId } : {};

    const series = await Serie.find(query)
      .populate('category')
      .populate('tournament');

    res.json(series);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, category, tournament } = req.body;

    if (!name || !category || !tournament) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    // Crear la serie
    const serie = new Serie({ name, category, tournament });
    await serie.save();

    // Actualizar el torneo agregando esta serie
    await Tournament.findByIdAndUpdate(
      tournament,
      { $addToSet: { series: serie._id } }, // $addToSet evita duplicados
      { new: true }
    );

    res.status(201).json(serie);
  } catch (err) {
    console.error("Error al crear serie:", err);
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Serie.findByIdAndDelete(req.params.id);
    res.json({ message: 'Serie eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
