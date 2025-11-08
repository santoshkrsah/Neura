const mongoose = require('mongoose');
module.exports = mongoose.model('Note', new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  filePath: String,
  uploadedBy: String
}));