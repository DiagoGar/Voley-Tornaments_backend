const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  players: [{
    name: String,
    // required: true
  }],
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  serie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Serie',
    required: true
  },

  tournament: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament", required: true }
});

// Validación para asegurar que el número de jugadores coincida con el teamSize del torneo
TeamSchema.pre('validate', async function(next) {
  try {
    const tournament = await mongoose.model('Tournament').findById(this.tournament);
    if (!tournament) {
      return next(new Error('Torneo no encontrado'));
    }
    if (this.players.length !== tournament.teamSize) {
      return next(new Error(`El equipo debe tener exactamente ${tournament.teamSize} jugadores`));
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Team', TeamSchema);
