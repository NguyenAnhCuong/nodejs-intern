const mqtt = require("mqtt");

// Cấu hình thiết bị
const deviceId = "device_temp_001"; // tên thiết bị để phân biệt bảng
const client = mqtt.connect("mqtt://broker.hivemq.com");

client.on("connect", () => {
  console.log(`✅ ${deviceId} connected to broker`);

  setInterval(() => {
    const temperature = (Math.random() * 10 + 25).toFixed(2); // ví dụ random 25–35°C
    const payload = JSON.stringify({
      deviceId,
      temperature: parseFloat(temperature),
      timestamp: new Date().toISOString(),
    });

    client.publish("iot/device/data", payload, { qos: 1 }, (err) => {
      if (err) console.error("❌ Publish error:", err);
      else console.log(` Sent: ${payload}`);
    });
  }, 5000); // gửi mỗi 5 giây
});
