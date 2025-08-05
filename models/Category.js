const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    enum: ['Masculino', 'Femenino', 'Mixto'],
    required: true,
    unique: true
  }
});

module.exports = mongoose.model('Category', CategorySchema);
