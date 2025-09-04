const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");

// Get all chats for a group
router.get("/:groupId", chatController.getChats);

// Update chat
router.put("/:chatId", chatController.updateChat);

// Delete chat
router.delete("/:chatId", chatController.deleteChat);

router.post("/:groupId", chatController.createChat);

module.exports = router;
