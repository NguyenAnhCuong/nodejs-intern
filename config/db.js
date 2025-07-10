console.log("[DEBUG] DB_USER =", process.env.DB_USER);
console.log("[DEBUG] DB_PASSWORD =", process.env.DB_PASSWORD);

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "", // mặc định XAMPP không có pass
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

module.exports = pool;
require("dotenv").config(); // Thư viện dotenv để quản lý biến môi trường

//logsadas
