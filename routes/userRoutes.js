const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);

// Protected routes
router.put('/:id', protect, userController.updateUser);
router.delete('/:id', protect, userController.deleteUser);

module.exports = router;

