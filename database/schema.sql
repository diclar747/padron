-- ============================================================
-- SCHEMA POSTGRESQL - Padrón Electoral ANR
-- Compatible con Neon / Supabase / PostgreSQL
-- ============================================================

-- 1. Usuarios (veedores, coordinadores, logistica, candidato, admin)
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(50) DEFAULT 'veedor',
  qr_uuid VARCHAR(36) UNIQUE,
  activo BOOLEAN DEFAULT true,
  telefono VARCHAR(50) DEFAULT NULL,
  direccion VARCHAR(255) DEFAULT NULL,
  avatar VARCHAR(255) DEFAULT NULL,
  permisos JSONB DEFAULT NULL,
  distrito VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Barrios
CREATE TABLE IF NOT EXISTS barrios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  lat DECIMAL(10,8) DEFAULT NULL,
  lng DECIMAL(11,8) DEFAULT NULL,
  color_mapa VARCHAR(7) DEFAULT '#3388ff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Mesas
CREATE TABLE IF NOT EXISTS mesas (
  id SERIAL PRIMARY KEY,
  numero INTEGER NOT NULL UNIQUE,
  local VARCHAR(255) NOT NULL,
  direccion VARCHAR(255) DEFAULT NULL,
  lat DECIMAL(10,8) DEFAULT NULL,
  lng DECIMAL(11,8) DEFAULT NULL,
  electores_esperados INTEGER DEFAULT 0,
  barrio_id INTEGER DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (barrio_id) REFERENCES barrios(id) ON DELETE SET NULL
);

-- 4. Electores
CREATE TABLE IF NOT EXISTS electores (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  ci VARCHAR(50) DEFAULT NULL,
  telefono VARCHAR(50) DEFAULT NULL,
  direccion VARCHAR(255) DEFAULT NULL,
  barrio_id INTEGER DEFAULT NULL,
  lat DECIMAL(10,8) DEFAULT NULL,
  lng DECIMAL(11,8) DEFAULT NULL,
  mesa_id INTEGER DEFAULT NULL,
  estado VARCHAR(50) DEFAULT 'confirmado',
  observaciones TEXT DEFAULT NULL,
  veedor_id INTEGER DEFAULT NULL,
  foto_ci VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (barrio_id) REFERENCES barrios(id) ON DELETE SET NULL,
  FOREIGN KEY (mesa_id) REFERENCES mesas(id) ON DELETE SET NULL,
  FOREIGN KEY (veedor_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 5. Vehiculos logistica
CREATE TABLE IF NOT EXISTS logistica_vehiculos (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(50) DEFAULT 'movil',
  chofer VARCHAR(255) NOT NULL,
  telefono VARCHAR(50) DEFAULT NULL,
  placa VARCHAR(50) DEFAULT NULL,
  combustible DECIMAL(10,2) DEFAULT 0,
  lat DECIMAL(10,8) DEFAULT NULL,
  lng DECIMAL(11,8) DEFAULT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Traslados
CREATE TABLE IF NOT EXISTS logistica_traslados (
  id SERIAL PRIMARY KEY,
  elector_id INTEGER NOT NULL,
  vehiculo_id INTEGER NOT NULL,
  estado VARCHAR(50) DEFAULT 'pendiente',
  confirmado_por INTEGER DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (elector_id) REFERENCES electores(id) ON DELETE CASCADE,
  FOREIGN KEY (vehiculo_id) REFERENCES logistica_vehiculos(id) ON DELETE CASCADE,
  FOREIGN KEY (confirmado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 7. Incidencias (incluye barrio_id)
CREATE TABLE IF NOT EXISTS incidencias (
  id SERIAL PRIMARY KEY,
  veedor_id INTEGER DEFAULT NULL,
  tipo VARCHAR(50) DEFAULT 'incidente',
  descripcion TEXT DEFAULT NULL,
  lat DECIMAL(10,8) DEFAULT NULL,
  lng DECIMAL(11,8) DEFAULT NULL,
  foto_url VARCHAR(255) DEFAULT NULL,
  audio_url VARCHAR(255) DEFAULT NULL,
  barrio_id INTEGER DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (veedor_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 8. Sync queue
CREATE TABLE IF NOT EXISTS sync_log (
  id SERIAL PRIMARY KEY,
  tabla VARCHAR(50) NOT NULL,
  operacion VARCHAR(20) NOT NULL,
  payload JSONB,
  device_id VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
