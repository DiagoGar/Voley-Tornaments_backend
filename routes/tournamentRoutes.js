// routes/tournaments.js
const express = require("express");
const router = express.Router();
const Tournament = require("../models/Tournament.js");

// Crear torneo
router.post("/", async (req, res) => {
  try {
    const { name, category } = req.body;

    if (!category) {
      return res.status(400).json({ error: "La categoría es obligatoria" });
    }

    const torneo = new Tournament({ name, category });
    await torneo.save();
    res.status(201).json(torneo);
  } catch (error) {
    res.status(500).json({ error: "Error al crear torneo", details: error.message });
  }
});


// Listar torneos
router.get("/", async (req, res) => {
  const torneos = await Tournament.find();
  res.json(torneos);
});

// Obtener un torneo por ID
router.get("/:id", async (req, res) => {
  try {
    const torneo = await Tournament.findById(req.params.id)
      .populate("category")
      .populate("series")
      .populate("teams")
      .populate("matches");

    if (!torneo) {
      return res.status(404).json({ error: "Torneo no encontrado" });
    }

    res.json(torneo);
  } catch (err) {
    console.error("Error en GET /tournaments/:id:", err);
    res.status(500).json({ error: "Error al obtener el torneo" });
  }
});


// Finalizar torneo

router.put("/:id/finalize", async (req, res) => {
  try {
    const torneo = await Tournament.findById(req.params.id);
    if (!torneo) {
      return res.status(404).json({ error: "Torneo no encontrado" });
    }

    if (torneo.status === "closed") {
      return res
        .status(400)
        .json({ error: "El torneo ya fue finalizado previamente" });
    }

    torneo.status = "closed";
    torneo.finishedAt = new Date();
    await torneo.save();

    res.json({
      message: "✅ Torneo finalizado correctamente",
      torneo,
    });
  } catch (error) {
    console.error("Error al finalizar torneo:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});


module.exports = router;
