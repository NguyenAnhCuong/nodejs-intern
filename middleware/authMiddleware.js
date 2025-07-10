const jwt = require("jsonwebtoken");
require("dotenv").config();

// Middleware: Xác thực người dùng qua JWT
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Chưa xác thực" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role }
    // console.log(`🔑 Xác thực thành công: ${req.user.email} (${req.user.role})`);
    next();
  } catch (err) {
    return res.status(403).json({ message: "Token không hợp lệ" });
  }
}

// Middleware: Kiểm tra quyền admin
function requireAdmin(req, res, next) {
  if (req.user.role !== "ADMIN")
    return res.status(403).json({ message: "Cần quyền admin" });
  next();
}

module.exports = { verifyToken, requireAdmin };
