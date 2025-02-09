const db = require('../config/database');
const bcrypt = require('bcrypt');

// 获取资源列表
const getResources = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 12;
    const offset = (page - 1) * pageSize;
    
    let sql = `
      SELECT 
        id, name, type, cpu, memory, storage,
        storage_type, usage_type, price, status,
        description, created_at
      FROM resources
      WHERE 1=1
    `;
    const params = [];

    // 关键词搜索
    if (req.query.name) {
      sql += ` AND name LIKE ?`;
      params.push(`%${req.query.name}%`);
    }

    // 类型筛选
    if (req.query.type) {
      sql += ` AND type = ?`;
      params.push(req.query.type);
    }

    // 存储类型筛选
    if (req.query.storage_type) {
      sql += ` AND storage_type = ?`;
      params.push(req.query.storage_type);
    }

    // 使用场景筛选
    if (req.query.usage_type) {
      sql += ` AND usage_type = ?`;
      params.push(req.query.usage_type);
    }

    // 获取总数
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM resources WHERE 1=1
       ${req.query.name ? 'AND name LIKE ?' : ''}
       ${req.query.type ? 'AND type = ?' : ''}
       ${req.query.storage_type ? 'AND storage_type = ?' : ''}
       ${req.query.usage_type ? 'AND usage_type = ?' : ''}`,
      params
    );
    const total = countResult[0].total;

    // 添加排序和分页
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    // 执行查询
    const [resources] = await db.query(sql, params);

    res.json({
      items: resources,
      total,
      page,
      pageSize
    });
  } catch (error) {
    console.error('获取资源列表失败：', error);
    res.status(500).json({ 
      message: '获取资源列表失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 创建资源
const createResource = async (req, res) => {
  try {
    const {
      name,
      type,
      cpu,
      memory,
      storage,
      storage_type,
      usage_type,
      price,
      description
    } = req.body;

    const [result] = await db.query(
      `INSERT INTO resources (
        name, type, cpu, memory, storage,
        storage_type, usage_type, price, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, type, cpu, memory, storage, storage_type, usage_type, price, description]
    );

    res.json({
      id: result.insertId,
      message: '创建成功'
    });
  } catch (error) {
    console.error('创建资源失败：', error);
    res.status(500).json({ message: '创建资源失败' });
  }
};

// 更新资源
const updateResource = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      cpu,
      memory,
      storage,
      storage_type,
      usage_type,
      price,
      description
    } = req.body;

    await db.query(
      `UPDATE resources 
       SET name = ?, type = ?, cpu = ?, memory = ?,
           storage = ?, storage_type = ?, usage_type = ?,
           price = ?, description = ?
       WHERE id = ?`,
      [name, type, cpu, memory, storage, storage_type, usage_type, price, description, id]
    );

    res.json({ message: '更新成功' });
  } catch (error) {
    console.error('更新资源失败：', error);
    res.status(500).json({ message: '更新资源失败' });
  }
};

// 更新资源状态
const updateResourceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['available', 'unavailable'].includes(status)) {
      return res.status(400).json({ message: '无效的状态值' });
    }

    await db.query(
      'UPDATE resources SET status = ? WHERE id = ?',
      [status, id]
    );

    res.json({ message: '状态更新成功' });
  } catch (error) {
    console.error('更新资源状态失败：', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 删除资源
const deleteResource = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM resources WHERE id = ?', [id]);
    res.json({ message: '资源删除成功' });
  } catch (error) {
    console.error('删除资源失败：', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 获取订单列表
const getOrders = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, orderId, username, status } = req.query;
    console.log('查询参数:', { page, pageSize, orderId, username, status }); // 添加日志
    
    const offset = (page - 1) * pageSize;
    
    // 构建查询条件
    let whereClause = '';
    let params = [];
    
    if (orderId && orderId.trim()) {
      whereClause += whereClause ? ' AND ' : ' WHERE ';
      whereClause += 'o.id = ?';
      params.push(orderId.trim());
    }

    if (username && username.trim()) {
      whereClause += whereClause ? ' AND ' : ' WHERE ';
      whereClause += 'u.username LIKE ?';
      params.push(`%${username.trim()}%`);
    }

    if (status) {
      whereClause += whereClause ? ' AND ' : ' WHERE ';
      whereClause += 'o.status = ?';
      params.push(status);
    }

    // 打印 SQL 语句和参数
    const countSql = `
      SELECT COUNT(*) as total 
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      LEFT JOIN resources r ON o.resource_id = r.id
      ${whereClause}
    `;

    const querySql = `
      SELECT 
        o.id, o.user_id, o.resource_id, o.status, o.total_price,
        o.created_at,
        u.username, u.email,
        r.name as resource_name, r.type as resource_type,
        r.cpu, r.memory, r.storage, r.storage_type
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN resources r ON o.resource_id = r.id
      ${whereClause}
      ORDER BY o.id DESC LIMIT ? OFFSET ?
    `;
    
    console.log('SQL语句:', { countSql, querySql });
    console.log('SQL参数:', params);

    // 获取总数
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0].total;

    // 获取订单数据
    const [orders] = await db.query(
      querySql,
      [...params, parseInt(pageSize), offset]
    );

    res.json({
      code: 200,
      message: 'success',
      data: {
        items: orders,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error('获取订单列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取订单列表失败',
      error: error.message
    });
  }
};

// 获取订单详情
const getOrderDetail = async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT 
        o.id, o.user_id, o.resource_id, o.status, o.total_price, o.created_at,
        u.username, u.email, u.phone,
        r.name as resource_name, r.type as resource_type,
        r.cpu, r.memory, r.storage, r.storage_type
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN resources r ON o.resource_id = r.id
       WHERE o.id = ?`,
      [req.params.id]
    );
    
    if (orders.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '订单不存在'
      });
    }

    res.json({
      code: 200,
      message: 'success',
      data: orders[0]
    });
  } catch (error) {
    console.error('获取订单详情失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取订单详情失败',
      error: error.message
    });
  }
};

// 取消订单
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查订单是否存在且状态是否为待支付
    const [orders] = await db.query(
      'SELECT status FROM orders WHERE id = ?',
      [id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '订单不存在'
      });
    }

    if (orders[0].status !== '未支付') {
      return res.status(400).json({
        code: 400,
        message: '只能取消待支付的订单'
      });
    }

    // 更新订单状态
    await db.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      ['已取消', id]
    );

    res.json({
      code: 200,
      message: '订单取消成功'
    });
  } catch (error) {
    console.error('取消订单失败:', error);
    res.status(500).json({
      code: 500,
      message: '取消订单失败',
      error: error.message
    });
  }
};

// 获取统计数据
const getStatistics = async (req, res) => {
  try {
    // 获取用户总数
    const [userCountResult] = await db.query('SELECT COUNT(*) as count FROM users WHERE type = "user"');
    const userCount = userCountResult[0].count;

    // 获取资源总数（包括所有状态）
    const [resourceCountResult] = await db.query('SELECT COUNT(*) as count FROM resources');
    const resourceCount = resourceCountResult[0].count;

    // 获取订单统计信息（按状态分类）
    const [orderStats] = await db.query(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'paid' THEN total_price ELSE 0 END) as total_income,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
      FROM orders
    `);

    // 获取最近7天的订单趋势（包括所有状态）
    const [orderTrend] = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count
      FROM orders
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // 获取资源类型分布（包括所有状态）
    const [resourceTypes] = await db.query(`
      SELECT 
        type,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_count
      FROM resources
      GROUP BY type
    `);

    // 获取最近订单
    const [recentOrders] = await db.query(`
      SELECT 
        o.id,
        o.status,
        o.total_price,
        o.created_at,
        u.username,
        r.name as resource_name,
        r.type as resource_type
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN resources r ON o.resource_id = r.id
      ORDER BY o.created_at DESC
      LIMIT 5
    `);

    // 格式化最近订单的日期
    const formattedRecentOrders = recentOrders.map(order => ({
      ...order,
      created_at: order.created_at ? new Date(order.created_at).toLocaleString() : null
    }));

    // 返回更详细的统计数据
    res.json({
      userCount,
      resourceCount,
      orderStats: {
        totalCount: orderStats[0].total_count,
        totalIncome: orderStats[0].total_income || 0,
        pendingCount: orderStats[0].pending_count,
        paidCount: orderStats[0].paid_count,
        cancelledCount: orderStats[0].cancelled_count
      },
      orderTrend: orderTrend.map(item => ({
        date: item.date,
        totalCount: item.total_count,
        paidCount: item.paid_count
      })),
      resourceTypes: resourceTypes.map(item => ({
        type: item.type || '未知类型',
        totalCount: item.count,
        availableCount: item.available_count
      })),
      recentOrders: formattedRecentOrders
    });

  } catch (error) {
    console.error('获取统计数据失败：', error);
    res.status(500).json({ 
      message: '获取统计数据失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 获取用户列表
const getUsers = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, keyword } = req.query;
    console.log('查询参数:', { page, pageSize, keyword }); // 添加日志
    
    const offset = (page - 1) * pageSize;
    
    // 构建查询条件
    let whereClause = '';
    let params = [];
    
    if (keyword && keyword.trim()) {
      const searchKeyword = keyword.trim();
      whereClause += ' WHERE (';
      whereClause += 'username LIKE ? OR email LIKE ?';
      params.push(`%${searchKeyword}%`, `%${searchKeyword}%`);
      whereClause += ')';
    }

    // 打印 SQL 语句和参数
    const countSql = `SELECT COUNT(*) as total FROM users${whereClause}`;
    const querySql = `SELECT id, username, email, phone, type, status
                      FROM users${whereClause} 
                      ORDER BY id DESC LIMIT ? OFFSET ?`;
    
    console.log('SQL语句:', { countSql, querySql });
    console.log('SQL参数:', params);

    // 获取总数
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0].total;

    // 获取分页数据
    const [users] = await db.query(
      querySql,
      [...params, parseInt(pageSize), offset]
    );

    console.log('查询结果:', { total, users }); // 添加日志

    res.json({
      code: 200,
      message: 'success',
      data: {
        items: users,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取用户列表失败',
      error: error.message
    });
  }
};

// 获取用户详情
const getUserDetail = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, username, email, phone, type, status FROM users WHERE id = ?',
      [req.params.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    res.json({
      code: 200,
      message: 'success',
      data: users[0]
    });
  } catch (error) {
    console.error('获取用户详情失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取用户详情失败',
      error: error.message
    });
  }
};

// 更新用户状态
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // 验证状态值
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        code: 400,
        message: '无效的状态值'
      });
    }

    await db.query(
      'UPDATE users SET status = ? WHERE id = ?',
      [status, id]
    );

    res.json({
      code: 200,
      message: '状态更新成功'
    });
  } catch (error) {
    console.error('更新用户状态失败:', error);
    res.status(500).json({
      code: 500,
      message: '更新用户状态失败',
      error: error.message
    });
  }
};

// 删除用户
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM users WHERE id = ?', [id]);

    res.json({
      code: 200,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({
      code: 500,
      message: '删除用户失败',
      error: error.message
    });
  }
};

// 删除订单
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查订单是否存在且状态是否为已支付或已取消
    const [orders] = await db.query(
      'SELECT status FROM orders WHERE id = ?',
      [id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '订单不存在'
      });
    }

    if (orders[0].status !== '已支付' && orders[0].status !== '已取消') {
      return res.status(400).json({
        code: 400,
        message: '只能删除已支付或已取消的订单'
      });
    }

    // 删除订单
    await db.query('DELETE FROM orders WHERE id = ?', [id]);

    res.json({
      code: 200,
      message: '订单删除成功'
    });
  } catch (error) {
    console.error('删除订单失败:', error);
    res.status(500).json({
      code: 500,
      message: '删除订单失败',
      error: error.message
    });
  }
};

// 获取订单统计数据
const getOrderStatistics = async (req, res) => {
  try {
    // 获取本月订单总数和总收入
    const [currentMonth] = await db.query(`
      SELECT 
        COUNT(*) as totalOrders,
        SUM(CASE WHEN status = '已支付' THEN total_price ELSE 0 END) as totalIncome
      FROM orders 
      WHERE created_at >= DATE_FORMAT(NOW() ,'%Y-%m-01')
    `)

    // 获取上月订单总数和总收入
    const [lastMonth] = await db.query(`
      SELECT 
        COUNT(*) as totalOrders,
        SUM(CASE WHEN status = '已支付' THEN total_price ELSE 0 END) as totalIncome
      FROM orders 
      WHERE created_at >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH) ,'%Y-%m-01')
        AND created_at < DATE_FORMAT(NOW() ,'%Y-%m-01')
    `)

    // 计算环比增长
    const orderTrend = lastMonth[0].totalOrders === 0 ? 0 :
      ((currentMonth[0].totalOrders - lastMonth[0].totalOrders) / lastMonth[0].totalOrders * 100).toFixed(2)
    
    const incomeTrend = lastMonth[0].totalIncome === 0 ? 0 :
      ((currentMonth[0].totalIncome - lastMonth[0].totalIncome) / lastMonth[0].totalIncome * 100).toFixed(2)

    res.json({
      code: 200,
      data: {
        totalOrders: currentMonth[0].totalOrders,
        totalIncome: currentMonth[0].totalIncome || 0,
        orderTrend: Number(orderTrend),
        incomeTrend: Number(incomeTrend)
      }
    })
  } catch (error) {
    console.error('获取订单统计数据失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取订单统计数据失败'
    })
  }
}

// 获取控制台统计数据
const getDashboardStats = async (req, res) => {
  try {
    // 获取本月数据
    const [currentMonth] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE type = 'user') as userCount,
        (SELECT COUNT(*) FROM resources) as resourceCount,
        (SELECT COUNT(*) FROM orders WHERE created_at >= DATE_FORMAT(NOW() ,'%Y-%m-01')) as orderCount,
        (SELECT COALESCE(SUM(total_price), 0) FROM orders 
         WHERE status = '已支付' AND created_at >= DATE_FORMAT(NOW() ,'%Y-%m-01')) as totalIncome
      FROM dual
    `)

    // 获取上月数据用于计算环比
    const [lastMonth] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users 
         WHERE type = 'user' 
         AND registration_date >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH) ,'%Y-%m-01')
         AND registration_date < DATE_FORMAT(NOW() ,'%Y-%m-01')) as userCount,
        (SELECT COUNT(*) FROM orders 
         WHERE created_at >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH) ,'%Y-%m-01')
         AND created_at < DATE_FORMAT(NOW() ,'%Y-%m-01')) as orderCount,
        (SELECT COALESCE(SUM(total_price), 0) FROM orders 
         WHERE status = '已支付'
         AND created_at >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH) ,'%Y-%m-01')
         AND created_at < DATE_FORMAT(NOW() ,'%Y-%m-01')) as totalIncome
      FROM dual
    `)

    // 计算环比增长率
    const userTrend = lastMonth[0].userCount === 0 ? 0 :
      ((currentMonth[0].userCount - lastMonth[0].userCount) / lastMonth[0].userCount * 100).toFixed(2)
    
    const orderTrend = lastMonth[0].orderCount === 0 ? 0 :
      ((currentMonth[0].orderCount - lastMonth[0].orderCount) / lastMonth[0].orderCount * 100).toFixed(2)
    
    const incomeTrend = lastMonth[0].totalIncome === 0 ? 0 :
      ((currentMonth[0].totalIncome - lastMonth[0].totalIncome) / lastMonth[0].totalIncome * 100).toFixed(2)

    res.json({
      code: 200,
      data: {
        userCount: {
          value: currentMonth[0].userCount,
          trend: Number(userTrend)
        },
        resourceCount: {
          value: currentMonth[0].resourceCount,
          trend: 0  // 资源总数不计算环比
        },
        orderCount: {
          value: currentMonth[0].orderCount,
          trend: Number(orderTrend)
        },
        totalIncome: {
          value: Number(currentMonth[0].totalIncome || 0).toFixed(2),
          trend: Number(incomeTrend)
        }
      }
    })
  } catch (error) {
    console.error('获取控制台统计数据失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取控制台统计数据失败'
    })
  }
}

// 获取订单趋势数据
const getOrderTrends = async (req, res) => {
  try {
    const { type = 'week' } = req.query
    const period = type === 'week' ? 7 : 30
    
    // 获取当前时间，确保使用正确的时区
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // 获取最近7天或30天的订单数据
    const [trends] = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_count,
        SUM(CASE WHEN status = '已支付' THEN 1 ELSE 0 END) as paid_count
      FROM orders
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND created_at <= NOW()
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [period])

    console.log('Order trends query result:', trends)

    // 生成日期数组，包括今天
    const dates = []
    const totalOrders = []
    const paidOrders = []
    
    let currentDate = new Date(todayStart)
    currentDate.setDate(currentDate.getDate() - period + 1)
    
    for (let i = 0; i < period; i++) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const trend = trends.find(t => t.date.toISOString().split('T')[0] === dateStr)
      
      dates.push(type === 'week' ? 
        ['周日','周一','周二','周三','周四','周五','周六'][currentDate.getDay()] : 
        dateStr)
      totalOrders.push(trend ? trend.total_count : 0)
      paidOrders.push(trend ? trend.paid_count : 0)
      
      currentDate.setDate(currentDate.getDate() + 1)
    }

    console.log('Processed trends data:', {
      dates,
      totalOrders,
      paidOrders
    })

    res.json({
      code: 200,
      data: {
        dates,
        series: [
          {
            name: '总订单数',
            data: totalOrders
          },
          {
            name: '已支付订单',
            data: paidOrders
          }
        ]
      }
    })
  } catch (error) {
    console.error('获取订单趋势数据失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取订单趋势数据失败'
    })
  }
}

// 获取资源分布数据
const getResourceDistribution = async (req, res) => {
  try {
    const [distribution] = await db.query(`
      SELECT 
        type,
        COUNT(*) as value,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as activeCount
      FROM resources
      GROUP BY type
      ORDER BY FIELD(type, 'basic', 'performance', 'premium')
    `)

    console.log('Resource distribution query result:', distribution)

    res.json({
      code: 200,
      data: distribution.map(item => ({
        name: item.type === 'basic' ? '基础型' : 
              item.type === 'performance' ? '性能型' : 
              item.type === 'premium' ? '高级型' : item.type,
        value: Number(item.value),
        activeCount: Number(item.activeCount)
      }))
    })
  } catch (error) {
    console.error('获取资源分布数据失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取资源分布数据失败'
    })
  }
}

// 获取最新订单
const getRecentOrders = async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT 
        o.id,
        o.status,
        o.total_price as amount,
        o.created_at,
        u.username,
        r.name as product_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN resources r ON o.resource_id = r.id
      ORDER BY o.created_at DESC
      LIMIT 5
    `)

    res.json({
      code: 200,
      data: orders.map(order => ({
        id: order.id,
        user: { username: order.username },
        product: { name: order.product_name },
        amount: Number(order.amount).toFixed(2),
        status: order.status,
        created_at: order.created_at
      }))
    })
  } catch (error) {
    console.error('获取最新订单失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取最新订单失败'
    })
  }
}

// 获取产品销量排行
const getProductRanking = async (req, res) => {
  try {
    const [ranking] = await db.query(`
      SELECT 
        r.name,
        r.type,
        COUNT(*) as sales_count,
        SUM(o.total_price) as total_amount
      FROM orders o
      LEFT JOIN resources r ON o.resource_id = r.id
      WHERE o.status = '已支付'
      GROUP BY r.id
      ORDER BY sales_count DESC
      LIMIT 5
    `)

    res.json({
      code: 200,
      data: ranking.map(item => ({
        name: item.name,
        value: item.sales_count,
        amount: Number(item.total_amount).toFixed(2)
      }))
    })
  } catch (error) {
    console.error('获取产品销量排行失败:', error)
    res.status(500).json({
      code: 500,
      message: '获取产品销量排行失败'
    })
  }
}

module.exports = {
  getResources,
  createResource,
  updateResource,
  updateResourceStatus,
  deleteResource,
  getOrders,
  getOrderDetail,
  cancelOrder,
  getStatistics,
  getUsers,
  getUserDetail,
  updateUserStatus,
  deleteUser,
  deleteOrder,
  getOrderStatistics,
  getDashboardStats,
  getOrderTrends,
  getResourceDistribution,
  getRecentOrders,
  getProductRanking
}; 