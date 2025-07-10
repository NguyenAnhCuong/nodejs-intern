const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 4306,  // thêm dòng này!
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_iot'
});

connection.connect((err) => {
  if (err) {
    console.error('❌ Lỗi kết nối MySQL:', err.message);
  } else {
    console.log('✅ Kết nối MySQL thành công!');
  }
});
