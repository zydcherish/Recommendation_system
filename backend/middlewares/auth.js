const jwt = require('jsonwebtoken');
const db = require('../db');

// Token验证中间件
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ 
      code: 401,
      message: '未提供认证令牌'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;  // 包含 id, email, type
    next();
  } catch (error) {
    console.error('Token验证失败:', error);
    res.status(401).json({ 
      code: 401,
      message: 'Token无效或已过期'
    });
  }
};

// 管理员权限验证中间件
const verifyAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        code: 401,
        message: '未经授权的访问'
      });
    }

    const [users] = await db.execute(
      'SELECT type FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0 || users[0].type !== 'admin') {
      return res.status(403).json({ 
        code: 403,
        message: '需要管理员权限'
      });
    }

    next();
  } catch (error) {
    console.error('验证管理员权限失败：', error);
    res.status(500).json({ 
      code: 500,
      message: '服务器错误'
    });
  }
};

module.exports = {
  verifyToken,
  verifyAdmin
}; 