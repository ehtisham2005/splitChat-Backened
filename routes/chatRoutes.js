const express = require('express');
const { body, param } = require('express-validator');
const chatController = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();

/**
 * GET /api/chats/:groupId?page=&limit=
 * List messages for a group
 */
router.get(
  '/:groupId',
  protect,
  [param('groupId').isMongoId().withMessage('Invalid group ID')],
  validateRequest,
  chatController.getChats
);

/**
 * POST /api/chats/:groupId
 * Send a message to a group
 * Body: { message }
 */
router.post(
  '/:groupId',
  protect,
  [
    param('groupId').isMongoId().withMessage('Invalid group ID'),
    body('message').trim().notEmpty().withMessage('Message text is required'),
  ],
  validateRequest,
  chatController.createChat
);

/**
 * PUT /api/chats/:chatId
 * Edit a message (owner only)
 * Body: { message }
 */
router.put(
  '/:chatId',
  protect,
  [
    param('chatId').isMongoId().withMessage('Invalid chat ID'),
    body('message').trim().notEmpty().withMessage('Message text is required'),
  ],
  validateRequest,
  chatController.updateChat
);

/**
 * DELETE /api/chats/:chatId
 * Delete a message (owner only)
 */
router.delete(
  '/:chatId',
  protect,
  [param('chatId').isMongoId().withMessage('Invalid chat ID')],
  validateRequest,
  chatController.deleteChat
);

module.exports = router;
