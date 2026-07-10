-- ============================================================
-- SCHEMA POSTGRESQL - Padrón Electoral ANR
-- Compatible con Neon / Supabase / PostgreSQL
-- Actualizado a partir de backup_padron.sql (respaldo real de producción,
-- generado 2026-07-10) para reflejar las tablas que el código
-- (routes/electores.js, routes/mesas.js, routes/barrios.js, etc.)
-- realmente usa hoy: mas_pda / seccio / secc_local reemplazan a las
-- antiguas electores / mesas / barrios.
-- ============================================================

-- 1. Usuarios (veedores, coordinadores, logistica, candidato, admin)
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(50) DEFAULT 'veedor',
  qr_uuid VARCHAR(36),
  activo BOOLEAN DEFAULT true,
  telefono VARCHAR(50) DEFAULT NULL,
  direccion VARCHAR(255) DEFAULT NULL,
  avatar VARCHAR(255) DEFAULT NULL,
  permisos JSONB DEFAULT NULL,
  distrito VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Secciones electorales (departamento / distrito / local de votación)
CREATE TABLE IF NOT EXISTS seccio (
  id SERIAL PRIMARY KEY,
  codigo_dep INTEGER,
  ndepart VARCHAR(255),
  codigo_dis INTEGER,
  ndistrito VARCHAR(255),
  zona INTEGER,
  codigo_sec INTEGER,
  descripcio VARCHAR(255),
  w_seccio VARCHAR(255),
  direccion VARCHAR(255),
  local_vota VARCHAR(255)
);

-- 3. Locales de votación por sección
CREATE TABLE IF NOT EXISTS secc_local (
  id SERIAL PRIMARY KEY,
  codigo_dep INTEGER,
  codigo_dis INTEGER,
  codigo_sec INTEGER,
  codigo_loc INTEGER,
  cod_local INTEGER,
  nombre_loc VARCHAR(255),
  direccion VARCHAR(255),
  recibido VARCHAR(255),
  secc_loc INTEGER
);

-- 4. Padrón de electores (mesa + PDA), tabla principal del padrón real
CREATE TABLE IF NOT EXISTS mas_pda (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255),
  apellido VARCHAR(255),
  numero_ced VARCHAR(50),
  direccion VARCHAR(255),
  codigo_sec INTEGER,
  mesa INTEGER DEFAULT 1,
  sec_loc INTEGER,
  votado INTEGER DEFAULT 0,
  observaciones TEXT,
  veedor_id INTEGER,
  lat_voto NUMERIC DEFAULT NULL,
  lng_voto NUMERIC DEFAULT NULL,
  orden INTEGER DEFAULT 999,
  telefono VARCHAR(50) DEFAULT NULL
);

-- 5. Vehiculos logistica
CREATE TABLE IF NOT EXISTS logistica_vehiculos (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(50) DEFAULT 'movil',
  chofer VARCHAR(255) NOT NULL,
  telefono VARCHAR(50) DEFAULT NULL,
  placa VARCHAR(50) DEFAULT NULL,
  combustible NUMERIC DEFAULT 0,
  lat NUMERIC DEFAULT NULL,
  lng NUMERIC DEFAULT NULL,
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Gastos de logistica (combustible, viáticos, etc.)
CREATE TABLE IF NOT EXISTS logistica_gastos (
  id SERIAL PRIMARY KEY,
  concepto VARCHAR(255) NOT NULL,
  monto NUMERIC NOT NULL,
  vehiculo_id INTEGER,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  observaciones TEXT,
  barrio_id INTEGER
);

-- 8. Incidencias (reporte de emergencias)
CREATE TABLE IF NOT EXISTS incidencias (
  id SERIAL PRIMARY KEY,
  veedor_id INTEGER DEFAULT NULL,
  tipo VARCHAR(50) DEFAULT 'incidente',
  descripcion TEXT DEFAULT NULL,
  lat NUMERIC DEFAULT NULL,
  lng NUMERIC DEFAULT NULL,
  foto_url VARCHAR(255) DEFAULT NULL,
  audio_url VARCHAR(255) DEFAULT NULL,
  barrio_id INTEGER DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Sync queue (modo offline)
CREATE TABLE IF NOT EXISTS sync_log (
  id SERIAL PRIMARY KEY,
  tabla VARCHAR(50) NOT NULL,
  operacion VARCHAR(20) NOT NULL,
  payload JSONB,
  device_id VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Módulo de campaña (camp_*)
-- ============================================================

-- 10. Presupuestos de campaña
CREATE TABLE IF NOT EXISTS camp_presupuestos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  monto_total BIGINT NOT NULL DEFAULT 0,
  color VARCHAR(50) DEFAULT 'blue',
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER
);

-- 11. Gastos de campaña, ligados a un presupuesto
CREATE TABLE IF NOT EXISTS camp_gastos (
  id SERIAL PRIMARY KEY,
  presupuesto_id INTEGER,
  categoria VARCHAR(255) NOT NULL,
  monto BIGINT NOT NULL,
  descripcion TEXT,
  responsable_id INTEGER,
  responsable_nombre VARCHAR(255),
  fecha DATE DEFAULT CURRENT_DATE,
  hora TIME DEFAULT CURRENT_TIME,
  foto_url TEXT,
  lat NUMERIC,
  lng NUMERIC,
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Caja (ingresos/egresos de efectivo de campaña)
CREATE TABLE IF NOT EXISTS camp_caja (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(255) NOT NULL,
  monto BIGINT NOT NULL,
  descripcion TEXT,
  responsable_id INTEGER,
  responsable_nombre VARCHAR(255),
  destinatario_nombre VARCHAR(255),
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  observaciones TEXT
);

-- 13. Actividades de campaña
CREATE TABLE IF NOT EXISTS camp_actividades (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(255),
  vehiculo_id INTEGER,
  responsable_id INTEGER,
  responsable_nombre VARCHAR(255),
  lat NUMERIC,
  lng NUMERIC,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. Tareas de campaña
CREATE TABLE IF NOT EXISTS camp_tareas (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  tipo VARCHAR(255),
  asignado_nombre VARCHAR(255),
  vehiculo_id INTEGER,
  estado VARCHAR(255) DEFAULT 'pendiente',
  prioridad VARCHAR(255) DEFAULT 'normal',
  tiempo_estimado INTEGER,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Vehiculos de campaña (distintos de logistica_vehiculos)
CREATE TABLE IF NOT EXISTS camp_vehiculos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  placa VARCHAR(255) DEFAULT NULL,
  modelo VARCHAR(255) DEFAULT NULL,
  chofer VARCHAR(255) DEFAULT NULL,
  telefono VARCHAR(255) DEFAULT NULL,
  capacidad INTEGER DEFAULT 5,
  combustible INTEGER DEFAULT 100,
  estado VARCHAR(255) DEFAULT 'disponible',
  observaciones TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
