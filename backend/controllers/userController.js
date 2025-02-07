const db = require('../utils/db');

// 获取用户信息
const getProfile = async (req, res) => {
  try {
    const [users] = await db.execute(
      'SELECT id, username, email, phone FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    res.json({
      code: 200,
      data: users[0]
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取用户信息失败'
    });
  }
};

// 更新用户信息
const updateProfile = async (req, res) => {
  try {
    const { email, phone } = req.body;

    await db.execute(
      'UPDATE users SET email = ?, phone = ? WHERE id = ?',
      [email, phone, req.user.id]
    );

    // 获取更新后的用户信息
    const [users] = await db.execute(
      'SELECT id, username, email, phone FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({
      code: 200,
      message: '更新成功',
      data: users[0]
    });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({
      code: 500,
      message: '更新用户信息失败'
    });
  }
};

// 获取用户订单
const getUserOrders = async (req, res) => {
  try {
    const [orders] = await db.execute(
      `SELECT o.*, r.name as resource_name, r.cpu, r.memory, r.storage 
       FROM orders o 
       LEFT JOIN resources r ON o.resource_id = r.id 
       WHERE o.user_id = ? 
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    res.json({
      code: 200,
      data: orders
    });
  } catch (error) {
    console.error('获取用户订单失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取用户订单失败'
    });
  }
};

// 获取用户浏览历史
const getBrowsingHistory = async (req, res) => {
  try {
    const [history] = await db.execute(
      `SELECT h.*, r.name, r.type, r.price 
       FROM browsing_history h
       LEFT JOIN resources r ON h.resource_id = r.id
       WHERE h.user_id = ?
       ORDER BY h.timestamp DESC
       LIMIT 10`,
      [req.user.id]
    );

    res.json({
      code: 200,
      data: history
    });
  } catch (error) {
    console.error('获取浏览历史失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取浏览历史失败'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getUserOrders,
  getBrowsingHistory
}; 