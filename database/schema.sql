CREATE DATABASE IF NOT EXISTS padron CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE padron;

-- 1. Usuarios (veedores, coordinadores, logistica, candidato, admin)
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('veedor','coordinador','logistica','candidato','admin') DEFAULT 'veedor',
  qr_uuid VARCHAR(36) UNIQUE,
  activo TINYINT(1) DEFAULT 1,
  telefono VARCHAR(50) DEFAULT NULL,
  direccion VARCHAR(255) DEFAULT NULL,
  avatar VARCHAR(255) DEFAULT NULL,
  permisos JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Barrios
CREATE TABLE IF NOT EXISTS barrios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  lat DECIMAL(10,8) DEFAULT NULL,
  lng DECIMAL(11,8) DEFAULT NULL,
  color_mapa VARCHAR(7) DEFAULT '#3388ff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Mesas
CREATE TABLE IF NOT EXISTS mesas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero INT NOT NULL UNIQUE,
  local VARCHAR(255) NOT NULL,
  direccion VARCHAR(255) DEFAULT NULL,
  lat DECIMAL(10,8) DEFAULT NULL,
  lng DECIMAL(11,8) DEFAULT NULL,
  electores_esperados INT DEFAULT 0,
  barrio_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (barrio_id) REFERENCES barrios(id) ON DELETE SET NULL
);

-- 4. Electores
CREATE TABLE IF NOT EXISTS electores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  ci VARCHAR(50) DEFAULT NULL,
  telefono VARCHAR(50) DEFAULT NULL,
  direccion VARCHAR(255) DEFAULT NULL,
  barrio_id INT DEFAULT NULL,
  lat DECIMAL(10,8) DEFAULT NULL,
  lng DECIMAL(11,8) DEFAULT NULL,
  mesa_id INT DEFAULT NULL,
  estado ENUM('confirmado','dudoso','no_vota','ausente','ya_voto') DEFAULT 'confirmado',
  observaciones TEXT DEFAULT NULL,
  veedor_id INT DEFAULT NULL,
  foto_ci VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (barrio_id) REFERENCES barrios(id) ON DELETE SET NULL,
  FOREIGN KEY (mesa_id) REFERENCES mesas(id) ON DELETE SET NULL,
  FOREIGN KEY (veedor_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 5. Vehiculos logistica
CREATE TABLE IF NOT EXISTS logistica_vehiculos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo VARCHAR(50) DEFAULT 'movil',
  chofer VARCHAR(255) NOT NULL,
  telefono VARCHAR(50) DEFAULT NULL,
  placa VARCHAR(50) DEFAULT NULL,
  combustible DECIMAL(10,2) DEFAULT 0,
  lat DECIMAL(10,8) DEFAULT NULL,
  lng DECIMAL(11,8) DEFAULT NULL,
  activo TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Traslados
CREATE TABLE IF NOT EXISTS logistica_traslados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  elector_id INT NOT NULL,
  vehiculo_id INT NOT NULL,
  estado ENUM('pendiente','en_camino','completado','cancelado') DEFAULT 'pendiente',
  confirmado_por INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (elector_id) REFERENCES electores(id) ON DELETE CASCADE,
  FOREIGN KEY (vehiculo_id) REFERENCES logistica_vehiculos(id) ON DELETE CASCADE,
  FOREIGN KEY (confirmado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 7. Incidencias
CREATE TABLE IF NOT EXISTS incidencias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  veedor_id INT DEFAULT NULL,
  tipo VARCHAR(50) DEFAULT 'incidente',
  descripcion TEXT DEFAULT NULL,
  lat DECIMAL(10,8) DEFAULT NULL,
  lng DECIMAL(11,8) DEFAULT NULL,
  foto_url VARCHAR(255) DEFAULT NULL,
  audio_url VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (veedor_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 8. Sync queue (server-side audit)
CREATE TABLE IF NOT EXISTS sync_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tabla VARCHAR(50) NOT NULL,
  operacion VARCHAR(20) NOT NULL,
  payload JSON,
  device_id VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
