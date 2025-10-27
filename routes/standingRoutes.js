const express = require("express");
const router = express.Router();
const Standing = require("../models/Standing");

router.get("/", async (req, res) => {
  try {
    const { tournamentId, serieId } = req.query;

    if (!tournamentId) {
      return res.status(400).json({ error: "Debe enviar un tournamentId" });
    }

    let filter = { tournament: tournamentId };
    if (serieId) filter.serie = serieId;

    const standings = await Standing.find(filter)
      .populate("team")
      .populate({
        path: "serie",
        populate: { path: "category" },
      })
      .populate({
        path: "tournament",
        select: "name status",
      });

    res.json(standings);
  } catch (error) {
    console.error("Error al obtener standings:", error);
    res.status(500).json({ error: "Error al obtener standings" });
  }
});

router.post("/", async (req, res) => {
  try {
    if (!req.body.tournament) {
      return res.status(400).json({ error: "El torneo es obligatorio" });
    }

    const standing = new Standing(req.body);
    await standing.save();
    res.status(201).json(standing);
  } catch (error) {
    console.error("Error al crear standing:", error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
