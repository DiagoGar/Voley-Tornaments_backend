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

module.exports = mongoose.model('Team', TeamSchema);
