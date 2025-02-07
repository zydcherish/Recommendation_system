const logger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const { method, url } = req;
  
  console.log(`${timestamp} - ${method} ${url}`);
  
  if (method === 'POST' || method === 'PUT') {
    // 过滤掉敏感信息
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.password) {
      sanitizedBody.password = '******';
    }
    console.log('请求体:', sanitizedBody);
  }
  
  next();
};

module.exports = logger; 