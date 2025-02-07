const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const User = require('../models/user')

exports.login = async (ctx) => {
  const { username, password } = ctx.request.body
  
  try {
    const user = await User.findOne({ 
      where: { username },
      attributes: ['id', 'username', 'password', 'type']  // 确保包含type字段
    })

    if (!user) {
      ctx.status = 401
      ctx.body = {
        code: 401,
        message: '用户名或密码错误'
      }
      return
    }

    const isValid = await bcrypt.compare(password, user.password)
    
    if (!isValid) {
      ctx.status = 401
      ctx.body = {
        code: 401,
        message: '用户名或密码错误'
      }
      return
    }

    // 生成token
    const token = jwt.sign(
      { id: user.id, username: user.username, type: user.type },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    ctx.body = {
      code: 200,
      data: {
        id: user.id,
        username: user.username,
        type: user.type,
        token
      }
    }
  } catch (error) {
    ctx.status = 500
    ctx.body = {
      code: 500,
      message: '服务器错误'
    }
  }
} 