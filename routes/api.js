const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const nodemailer = require("nodemailer");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { log, error } = require("console");

// Cấu hình Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// GET /devices: Lấy danh sách thiết bị
router.get("/devices", async (req, res) => {
  try {
    let [rows] = await pool.query("SELECT * FROM devices");

    return res.status(200).json({ EC: 0, data: rows });
  } catch (error) {
    res.status(500).json({ EC: 1, error: error.message });
  }
});

// GET /devices/:id: Lấy chi tiết thiết bị
router.get("/devices/:id", verifyToken, async (req, res) => {
  const deviceId = req.params.id;
  const { id: userId, role } = req.user;

  // console.log("User ID:", userId);
  // console.log("Device ID:", deviceId);

  try {
    // Nếu là admin thì bỏ qua kiểm tra
    if (role !== "ADMIN") {
      const [permissions] = await pool.query(
        "SELECT * FROM user_device_permissions WHERE user_id = ? AND device_id = ? AND can_view = 1",
        [userId, deviceId]
      );

      // console.log("Permissions:", permissions);

      if (permissions.length === 0) {
        return res
          .status(403)
          .json({ message: "Không có quyền truy cập thiết bị này" });
      }
    }

    const [devices] = await pool.query("SELECT * FROM devices WHERE id = ?", [
      deviceId,
    ]);

    if (devices.length === 0)
      return res.status(404).json({ message: "Không tìm thấy thiết bị" });

    res.json(devices[0]);
  } catch (err) {
    res.status(500).json({ message: "Lỗi máy chủ", err: err.message });
  }
});

// POST /devices: Thêm thiết bị mới
router.post("/devices", async (req, res) => {
  const { id, name, status } = req.body;

  if (!id || !name) {
    return res.status(400).json({ error: "ID and name are required" });
  }
  if (id === "device_temp_" || id === "device_gas_") {
    return res.status(500).json({ error: "Invalid ID" });
  }

  try {
    // Kiểm tra xem ID đã tồn tại chưa
    const [existingDevice] = await pool.query(
      "SELECT * FROM devices WHERE id = ?",
      [id]
    );

    if (existingDevice.length > 0) {
      return res.status(409).json({ error: "Device ID already exists" }); // HTTP 409 Conflict
    }

    // Nếu chưa tồn tại thì thêm mới
    await pool.query(
      "INSERT INTO devices (id, name, status) VALUES (?, ?, ?)",
      [id, name, status || "active"]
    );

    res.status(201).json({ message: "Device created" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /devices/:id: Cập nhật thiết bị
router.put("/devices/:id", async (req, res) => {
  const { name, status } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE devices SET name = ?, status = ? WHERE id = ?",
      [name, status, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Device not found" });
    }
    res.json({ message: "Device updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /devices/:id: Xóa thiết bị
router.delete("/devices/:id", async (req, res) => {
  try {
    const [result] = await pool.query("DELETE FROM devices WHERE id = ?", [
      req.params.id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Device not found" });
    }
    res.json({ message: "Device deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /iot/data: Lấy dữ liệu IoT
router.get("/iot/data", async (req, res) => {
  const { deviceId, startTime, endTime } = req.query;
  let query = "SELECT * FROM iot_temp_data";
  let params = [];

  if (deviceId || startTime || endTime) {
    query += " WHERE";
    if (deviceId) {
      query += " device_id = ?";
      params.push(deviceId);
    }
    if (startTime) {
      query += deviceId ? " AND" : "";
      query += " timestamp >= ?";
      params.push(startTime);
    }
    if (endTime) {
      query += deviceId || startTime ? " AND" : "";
      query += " timestamp <= ?";
      params.push(endTime);
    }
  }

  // ⚠ Thêm ORDER BY trước LIMIT
  query += " ORDER BY timestamp DESC LIMIT 500";

  try {
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /alerts: Lấy danh sách alert
router.get("/alerts", verifyToken, async (req, res) => {
  try {
    const email = req.user.email;
    const [rows] = await pool.query(
      "SELECT * FROM alerts where user_email = ?",
      [email]
    );
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /alerts: Tạo alert thủ công
router.post("/alerts", async (req, res) => {
  const { deviceId, message, type, userEmail } = req.body;
  if (!deviceId || !message || !userEmail) {
    return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
  }

  try {
    await pool.query(
      "INSERT INTO alerts (id,device_id, message, type, user_email) VALUES (?,?, ?, ?, ?)",
      [uuidv4(), deviceId, message, type || "email", userEmail]
    );

    if (type === "email" || !type) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: "Cảnh báo từ thiết bị IoT",
        text: message,
      };
      await transporter.sendMail(mailOptions);
    }

    res.status(201).json({ message: "Alert đã được gửi" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/users", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM users");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/users", async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [username, email, hashedPassword, role]
    );
    res.status(201).json({ message: "User created" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/users/profile", verifyToken, async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  // Lấy và xử lý dữ liệu từ body
  const name = req.body.name?.trim(); // chỉ trim đầu cuối
  const role = req.body.role;

  // Kiểm tra name
  if (!name || name.length < 3 || name.length > 50) {
    return res.status(400).json({
      error: "Name must be 3-50 characters long.",
    });
  }

  // Regex: cho phép chữ cái (có dấu), số, dấu cách và _
  const nameRegex = /^[\p{L}0-9_ ]+$/u;
  if (!nameRegex.test(name)) {
    return res.status(400).json({
      error: "Name contains invalid characters.",
    });
  }

  // Kiểm tra role
  const validRoles = ["ADMIN", "USER"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      error: "Invalid role value.",
    });
  }

  // Cập nhật database
  try {
    await pool.query("UPDATE users SET name = ?, role = ? WHERE id = ?", [
      name,
      role,
      userId,
    ]);
    return res.status(200).json({ message: "User updated successfully." });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/register
router.post("/register", async (req, res) => {
  const { email, password, name } = req.body;

  // Kiểm tra các trường bắt buộc
  if (!email || !password || !name?.trim()) {
    return res.status(400).json({ message: "Thiếu email, mật khẩu hoặc tên" });
  }

  const trimmedName = name.trim();

  // Kiểm tra name hợp lệ
  if (trimmedName.length < 3 || trimmedName.length > 50) {
    return res
      .status(400)
      .json({ message: "Tên phải có độ dài từ 3 đến 50 ký tự" });
  }

  const nameRegex = /^[\p{L}0-9_ ]+$/u; // Cho phép chữ cái (có dấu), số, dấu cách, gạch dưới
  if (!nameRegex.test(trimmedName)) {
    return res.status(400).json({ message: "Tên chứa ký tự không hợp lệ" });
  }

  try {
    // Kiểm tra email đã tồn tại chưa
    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (users.length > 0) {
      return res.status(400).json({ message: "Email đã tồn tại" });
    }

    // Hash password và lưu user
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)",
      [uuidv4(), email, hashedPassword, trimmedName, "USER"]
    );

    return res.status(201).json({ message: "Đăng ký thành công" });
  } catch (err) {
    console.error("Lỗi khi đăng ký:", err);
    return res.status(500).json({ message: "Lỗi máy chủ", err: err.message });
  }
});

// POST /api/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Truy vấn người dùng theo name
    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (users.length === 0) {
      return res.status(400).json({ message: "Sai Email" });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Sai mật khẩu" });
    }

    // Tạo JWT token
    const token = jwt.sign(
      {
        id: user.id, // UUID
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES }
    );

    // Trả về token và role
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });
  } catch (err) {
    console.error("Lỗi đăng nhập:", err);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

router.post("/access", verifyToken, requireAdmin, async (req, res) => {
  const { user_id, device_id } = req.body;

  if (!user_id || !device_id)
    return res.status(400).json({ message: "Thiếu user_id hoặc device_id" });

  try {
    await pool.query(
      "INSERT IGNORE INTO user_device_permissions (id,user_id, device_id) VALUES (?,?, ?)",
      [uuidv4(), user_id, device_id]
    );
    res.json({ message: "Cấp quyền thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi máy chủ", err: err.message });
  }
});

router.post("/user/change-password", verifyToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.id; // lấy từ verifyToken (jwt)

  console.log(oldPassword, newPassword);

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: "Thiếu mật khẩu cũ hoặc mới" });
  }

  try {
    // 1. Lấy thông tin user hiện tại từ DB
    const [rows] = await pool.query("SELECT password FROM users WHERE id = ?", [
      userId,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    const hashedPassword = rows[0].password;

    // 2. So sánh mật khẩu cũ
    const isMatch = await bcrypt.compare(oldPassword, hashedPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "Mật khẩu cũ không đúng" });
    }

    // 3. Hash mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const newHashedPassword = await bcrypt.hash(newPassword, salt);

    // 4. Cập nhật mật khẩu
    await pool.query("UPDATE users SET password = ? WHERE id = ?", [
      newHashedPassword,
      userId,
    ]);

    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (err) {
    console.error("Lỗi khi đổi mật khẩu:", err);
    res.status(500).json({ message: "Lỗi máy chủ", error: err.message });
  }
});

module.exports = router;
