const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  expenses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Expense' }],
  chats: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chat' }],
}, { timestamps: true });

module.exports = mongoose.model('Group', groupSchema);
