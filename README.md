### Next.js + MUI + TypeScript

Các bước cần làm:

1. Clone dự án
2. Cài đặt các thư viện cần thiết: npm i
3. Chạy dự án với câu lệnh: npm start

Truy cập: http://localhost:8000/

4. Tạo database MySQL bằng câu lệnh sau:

```sql
CREATE DATABASE iotdevices;

-- Sử dụng cơ sở dữ liệu vừa tạo
USE iotdevices;

-- Tạo bảng iot_temp_data
CREATE TABLE iot_temp_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(100),
  temperature FLOAT,
  gas FLOAT DEFAULT NULL,
  timestamp DATETIME
);

-- Tạo bảng iot_gas_data
CREATE TABLE iot_gas_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(100),
  temperature FLOAT DEFAULT NULL,
  gas FLOAT,
  timestamp DATETIME
);

-- Tạo bảng devices
CREATE TABLE devices (
  id VARCHAR(50) PRIMARY KEY, -- Mã thiết bị (khóa chính)
  name VARCHAR(100),          -- Tên thiết bị cảm biến
  status VARCHAR(20) DEFAULT 'active' -- Trạng thái thiết bị
);

-- Tạo bảng users
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'USER') NOT NULL default "USER"
);

-- Tạo bảng user_device_permissions
CREATE TABLE user_device_permissions (
  id VARCHAR(50) PRIMARY KEY,
  user_id CHAR(36),
  device_id VARCHAR(50),
  can_view BOOLEAN DEFAULT true,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE TABLE alerts (
  id VARCHAR(50) PRIMARY KEY,
  device_id VARCHAR(255),
  message TEXT,
  type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_email VARCHAR(255),
  is_read BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  CONSTRAINT fk_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

INSERT INTO users (id, name,email,password, role)
VALUES (UUID(),'Admin',"admin@gmail.com" , "$2b$10$/JK3VwV59N4q2o214A7Y/.O/Yglp3jy0dbMXUaEkqKG5WC2tFbc32","ADMIN");

```

5. Giả lập lấy dữ liệu iot: cd .\client -> node .\iot_client1.js

**Lưu ý**:

- Chỉnh sửa thông tin database trong file .env
- Thay deviceId trong file iot_client.js bằng id trong database MySQL bảng devices
