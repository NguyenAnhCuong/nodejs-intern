const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://broker.hivemq.com', {
  clientId: 'device_' + Math.random().toString(16).slice(3),
});

client.on('connect', () => {
  console.log('Device connected to MQTT broker');

  // Gửi dữ liệu giả lập mỗi 5 giây
  setInterval(() => {
    const data = {
      deviceId: 'device_001',
      temperature: Math.floor(Math.random() * 50), // Nhiệt độ ngẫu nhiên từ 0-50°C
      timestamp: new Date().toISOString(),
    };
    client.publish('iot/device/data', JSON.stringify(data), { qos: 1 }, (err) => {
      if (err) {
        console.error('Publish error:', err);
        return;
      }
      console.log('Published data:', data);
    });
  }, 5000);
});

client.on('error', (error) => {
  console.error('MQTT error:', error);console.error('MQTT error:', error);
});