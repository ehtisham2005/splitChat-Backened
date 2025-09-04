const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');

router.post('/', groupController.createGroup);
router.get('/', groupController.getGroups);
router.post('/:groupId/members', groupController.addMember);     // ✅ Add member
router.delete('/:groupId/members/:userId', groupController.removeMember); // ✅ Remove member

module.exports = router;
