require("dotenv").config();
const express = require("express");
const http = require("http"); // 💡 thêm dòng này
const mqtt = require("mqtt");
const nodemailer = require("nodemailer");
const mysql = require("mysql2/promise");
const cors = require("cors");
const { Server } = require("socket.io"); // 💡 thêm dòng này

const app = express();
const port = 8000;

const server = http.createServer(app); // 💡 tạo http server từ express
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ⚙️ Middleware
app.use(cors());
app.use(express.json());

// 🔌 Socket.IO
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// 🛣️ API routes
const deviceRouter = require("./routes/api.js");
app.use("/api", deviceRouter);

// 💾 Kết nối CSDL
const pool = require("./config/db.js");

// 📡 Kết nối MQTT Broker
const mqttClient = mqtt.connect(
  process.env.MQTT_BROKER || "mqtt://broker.hivemq.com",
  {
    clientId: "server_" + Math.random().toString(16).substr(2, 8),
  }
);

mqttClient.on("connect", () => {
  console.log("✅ MQTT connected");
  mqttClient.subscribe("iot/device/data", { qos: 1 }, (err) => {
    if (err) console.error("❌ Subscribe error:", err.message);
    else console.log("📡 Subscribed to: iot/device/data");
  });
});

mqttClient.on("error", (err) => {
  console.error("❌ MQTT error:", err.message);
});

// 📧 Gửi email cảnh báo
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendEmailAlert(data) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_RECEIVER,
    subject: "🔥 Cảnh báo từ thiết bị IoT",
    text: `Thiết bị ${data.deviceId} báo nhiệt độ/gas cao: ${
      data.temperature || data.gas
    } lúc ${data.timestamp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📧 Email alert sent");
  } catch (error) {
    console.error("❌ Gửi email lỗi:", error.message);
  }
}

// 🧠 Lấy tên bảng theo deviceId
function getTableNameFromDeviceId(deviceId) {
  if (deviceId.startsWith("device_temp")) return "iot_temp_data";
  if (deviceId.startsWith("device_gas")) return "iot_gas_data";
  return "iot_data";
}

// 📥 Xử lý dữ liệu từ MQTT
mqttClient.on("message", async (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    console.log("📥 Nhận:", data);

    const formattedTimestamp = new Date(data.timestamp)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    const tableName = getTableNameFromDeviceId(data.deviceId);

    await pool.query(
      `INSERT INTO ${tableName} (device_id, temperature, gas, timestamp) VALUES (?, ?, ?, ?)`,
      [
        data.deviceId,
        data.temperature || null,
        data.gas || null,
        formattedTimestamp,
      ]
    );

    console.log(`💾 Dữ liệu lưu vào bảng ${tableName}`);

    // 💬 Phát dữ liệu realtime qua socket.io
    io.emit("iot_data", data); // tất cả client đang kết nối đều nhận được

    // 🔔 Gửi email nếu vượt ngưỡng
    if (
      (data.temperature && data.temperature > 35) ||
      (data.gas && data.gas > 80)
    ) {
      await sendEmailAlert(data);
    }
  } catch (err) {
    console.error("❌ Lỗi xử lý dữ liệu:", err.message);
  }
});

// ✅ API kiểm tra
app.get("/status", (req, res) => {
  res.json({ status: "✅ Server running and MQTT connected" });
});

// 🚀 Start server
server.listen(port, () => {
  console.log(`🚀 Server + Socket.IO listening at http://localhost:${port}`);
});
