const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  message: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);
