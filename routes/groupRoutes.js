const express = require('express');
const { body, param } = require('express-validator');
const groupController = require('../controllers/groupController');
const { protect } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();

//  Create group
router.post(
  '/',
  protect,
  [
    body('name').notEmpty().withMessage('Group name is required'),
    body('members')
      .optional()
      .isArray()
      .withMessage('Members must be an array of user IDs'),
  ],
  validateRequest,
  groupController.createGroup
);

//  Get groups of logged-in user
router.get('/', protect, groupController.getGroups);

//  Update group (only creator)
router.put(
  '/:groupId',
  protect,
  [
    param('groupId').isMongoId().withMessage('Invalid group ID'),
    body('name').optional().notEmpty().withMessage('Group name cannot be empty'),
  ],
  validateRequest,
  groupController.updateGroup
);

//  Delete group (only creator)
router.delete(
  '/:groupId',
  protect,
  [param('groupId').isMongoId().withMessage('Invalid group ID')],
  validateRequest,
  groupController.deleteGroup
);

//  Add member
router.post(
  '/:groupId/members',
  protect,
  [
    param('groupId').isMongoId().withMessage('Invalid group ID'),
    body('userId').notEmpty().withMessage('User ID is required')
      .isMongoId().withMessage('Invalid user ID'),
  ],
  validateRequest,
  groupController.addMember
);

//  Remove member
router.delete(
  '/:groupId/members/:userId',
  protect,
  [
    param('groupId').isMongoId().withMessage('Invalid group ID'),
    param('userId').isMongoId().withMessage('Invalid user ID'),
  ],
  validateRequest,
  groupController.removeMember
);

module.exports = router;
