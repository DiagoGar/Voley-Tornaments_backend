// routes/tournaments.js
const express = require("express");
const router = express.Router();
const Tournament = require("../models/Tournament.js");
const authMiddleware = require("../middlewares/authMiddleware.js");

// Crear torneo
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, category, teamSize } = req.body;

    if (!category) {
      return res.status(400).json({ error: "La categoría es obligatoria" });
    }

    // Validación del tamaño del equipo
    if (teamSize && ![2, 4, 6].includes(teamSize)) {
      return res.status(400).json({ error: "El tamaño del equipo debe ser 2, 4 o 6" });
    }

    const torneo = new Tournament({ 
      name, 
      category, 
      teamSize: teamSize || 6,
      user: req.user._id 
    });
    await torneo.save();
    res.status(201).json(torneo);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al crear torneo", details: error.message });
  }
});

// Listar torneos
router.get("/", authMiddleware, async (req, res) => {
  const torneos = await Tournament.find({ user: req.user._id });
  res.json(torneos);
});

// Obtener un torneo por ID
router.get("/:id", authMiddleware, async (req, res) => {
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
router.put("/:id/finalize", authMiddleware, async (req, res) => {
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
