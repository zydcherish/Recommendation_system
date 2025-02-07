const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middlewares/auth');

// 注册和登录路由
router.post('/register', authController.register);
router.post('/login', authController.login);  // 确保这里是/login
router.post('/logout', verifyToken, authController.logout);

// 用户信息路由
router.get('/user/info', verifyToken, authController.getUserInfo);
router.put('/user/info', verifyToken, authController.updateUserInfo);
router.post('/user/change-password', verifyToken, authController.changePassword);

module.exports = router; 