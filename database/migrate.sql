-- ============================================================
-- MIGRACIÓN POSTGRESQL - Padrón Electoral ANR
-- Ejecutar este script en la base de datos PostgreSQL (Neon)
-- ============================================================

-- 1. Añadir columna barrio_id a incidencias (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidencias' AND column_name = 'barrio_id'
  ) THEN
    ALTER TABLE incidencias ADD COLUMN barrio_id INTEGER DEFAULT NULL;
  END IF;
END $$;

-- 2. Añadir columna distrito a usuarios (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'distrito'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN distrito VARCHAR(255) DEFAULT NULL;
  END IF;
END $$;

-- 3. Crear tabla incidencias en PostgreSQL (si no existe)
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

-- 4. Crear tabla usuarios en PostgreSQL (si no existe)
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

-- 5. Crear tabla logistica_vehiculos (si no existe)
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

-- 6. Crear tabla logistica_traslados (si no existe)
CREATE TABLE IF NOT EXISTS logistica_traslados (
  id SERIAL PRIMARY KEY,
  elector_id INTEGER NOT NULL,
  vehiculo_id INTEGER NOT NULL,
  estado VARCHAR(50) DEFAULT 'pendiente',
  confirmado_por INTEGER DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Verificar columnas agregadas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'incidencias'
ORDER BY ordinal_position;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'usuarios'
ORDER BY ordinal_position;
