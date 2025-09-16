const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Ej: "Torneo Apertura 2025"
  category: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Category" }, // opcional
  status: { type: String, enum: ["open", "closed"], default: "open" }, // estado del torneo
  createdAt: { type: Date, default: Date.now },
  finishedAt: { type: Date },

  // relaciones
  series: [{ type: mongoose.Schema.Types.ObjectId, ref: "Serie" }],
  teams: [{ type: mongoose.Schema.Types.ObjectId, ref: "Team" }],
  matches: [{ type: mongoose.Schema.Types.ObjectId, ref: "Match" }],

  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // si hay login
});

module.exports = mongoose.model("Tournament", tournamentSchema);
