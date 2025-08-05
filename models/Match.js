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
  }
});

module.exports = mongoose.model('Match', MatchSchema);
