const express = require("express");
const router = express.Router();
const Category = require("../models/Category");

router.get("/", async (req, res) => {
  const categories = await Category.find();
  res.json(categories);
});

router.post("/", async (req, res) => {
  if (torneo.status === "closed") {
    return res
      .status(403)
      .json({
        error: "El torneo está finalizado. No se permiten más cambios.",
      });
  }
  const category = new Category(req.body);
  await category.save();
  res.status(201).json(category);
});

module.exports = router;
