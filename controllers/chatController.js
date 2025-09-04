const Chat = require('../models/Chat');
const Group = require('../models/Group');

// ✅ Get all chats of a group
exports.getChats = async (req, res) => {
  try {
    const chats = await Chat.find({ group: req.params.groupId })
      .populate('sender')
      .sort({ createdAt: 1 }); // optional: sort by oldest → newest
    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createChat = async (req, res) => {
  try {
    const { message, sender } = req.body;  // sender = userId
    const { groupId } = req.params;

    const newChat = await Chat.create({
      message,
      sender,
      group: groupId
    });

    // also push chat into group’s chat array if you’re storing references
    await Group.findByIdAndUpdate(groupId, { $push: { chats: newChat._id } });

    const populatedChat = await newChat.populate('sender');

    res.status(201).json(populatedChat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Update a chat message
exports.updateChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { message } = req.body;

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { message },
      { new: true }
    );

    if (!updatedChat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    res.json(updatedChat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Delete a chat message
exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    const deletedChat = await Chat.findByIdAndDelete(chatId);

    if (!deletedChat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    res.json({ message: "Chat deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
