const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  teamA: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  teamB: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  serie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Serie',
    required: true
  },
  startTime: Date,
  endTime: Date,
  result: {
    pointsA: Number,
    pointsB: Number
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },

  tournament: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament", required: true }
});

// Validación para asegurar que ambos equipos pertenezcan al mismo torneo
MatchSchema.pre('validate', async function(next) {
  try {
    const teamA = await mongoose.model('Team').findById(this.teamA);
    const teamB = await mongoose.model('Team').findById(this.teamB);
    if (!teamA || !teamB) {
      return next(new Error('Uno o ambos equipos no encontrados'));
    }
    if (teamA.tournament.toString() !== this.tournament.toString() ||
        teamB.tournament.toString() !== this.tournament.toString()) {
      return next(new Error('Ambos equipos deben pertenecer al torneo del partido'));
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Match', MatchSchema);
