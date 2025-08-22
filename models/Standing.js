const mongoose = require('mongoose');

const StandingSchema = new mongoose.Schema({
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
  },
  serie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Serie',
    required: true
  },
  matchesPlayed: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  pointsFor: { type: Number, default: 0 },
  pointsAgainst: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  position: { type: Number, default: null }
});

StandingSchema.index({ team: 1, serie: 1 }, { unique: true });

module.exports = mongoose.model('Standing', StandingSchema);
