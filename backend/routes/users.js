const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middlewares/auth');

// 所有路由处理逻辑都移到 controller 中
router.get('/profile', verifyToken, userController.getProfile);
router.put('/profile', verifyToken, userController.updateProfile);
router.get('/orders', verifyToken, userController.getUserOrders);
router.get('/history', verifyToken, userController.getBrowsingHistory);

module.exports = router;