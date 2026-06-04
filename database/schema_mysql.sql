-- ============================================================
-- SCHEMA MYSQL - Padrón Electoral ANR
-- Compatible con MySQL / MariaDB (Local)
-- ============================================================

-- 1. Usuarios (veedores, coordinadores, logistica, candidato, admin)
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(50) DEFAULT 'veedor',
  qr_uuid VARCHAR(36) UNIQUE,
  activo BOOLEAN DEFAULT true,
  telefono VARCHAR(50) DEFAULT NULL,
  direccion VARCHAR(255) DEFAULT NULL,
  avatar VARCHAR(255) DEFAULT NULL,
  permisos TEXT DEFAULT NULL, -- Usado para almacenar el JSON de permisos en formato de texto
  distrito VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Secciones (Barrios / Zonas)
CREATE TABLE IF NOT EXISTS seccio (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo_dep INT,
  ndepart VARCHAR(255),
  codigo_dis INT,
  ndistrito VARCHAR(255),
  zona INT,
  codigo_sec INT UNIQUE,
  descripcio VARCHAR(255),
  w_seccio VARCHAR(255),
  direccion VARCHAR(255),
  local_vota VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Locales de Votación (Mesas / Locales)
CREATE TABLE IF NOT EXISTS secc_local (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo_dep INT,
  codigo_dis INT,
  codigo_sec INT,
  codigo_loc INT,
  cod_local INT,
  nombre_loc VARCHAR(255),
  direccion VARCHAR(255),
  recibido VARCHAR(255),
  secc_loc INT UNIQUE,
  FOREIGN KEY (codigo_sec) REFERENCES seccio(codigo_sec) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Electores (mas_pda)
CREATE TABLE IF NOT EXISTS mas_pda (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255),
  apellido VARCHAR(255),
  numero_ced VARCHAR(50),
  direccion VARCHAR(255),
  codigo_sec INT,
  mesa INT DEFAULT 1,
  sec_loc INT,
  votado INT DEFAULT 0,
  observaciones TEXT,
  veedor_id INT,
  lat_voto DECIMAL(10,8) DEFAULT NULL,
  lng_voto DECIMAL(11,8) DEFAULT NULL,
  orden INT DEFAULT 999,
  telefono VARCHAR(50) DEFAULT NULL, -- Teléfono del elector guardado localmente
  KEY idx_cedula (numero_ced),
  FOREIGN KEY (codigo_sec) REFERENCES seccio(codigo_sec) ON DELETE SET NULL,
  FOREIGN KEY (sec_loc) REFERENCES secc_local(secc_loc) ON DELETE SET NULL,
  FOREIGN KEY (veedor_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Vehículos logística
CREATE TABLE IF NOT EXISTS logistica_vehiculos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo VARCHAR(50) DEFAULT 'movil',
  chofer VARCHAR(255) NOT NULL,
  telefono VARCHAR(50) DEFAULT NULL,
  placa VARCHAR(50) DEFAULT NULL,
  combustible DECIMAL(10,2) DEFAULT 0,
  lat DECIMAL(10,8) DEFAULT NULL,
  lng DECIMAL(11,8) DEFAULT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Traslados logística
CREATE TABLE IF NOT EXISTS logistica_traslados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  elector_id INT NOT NULL,
  vehiculo_id INT NOT NULL,
  estado VARCHAR(50) DEFAULT 'pendiente',
  confirmado_por INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (elector_id) REFERENCES mas_pda(id) ON DELETE CASCADE,
  FOREIGN KEY (vehiculo_id) REFERENCES logistica_vehiculos(id) ON DELETE CASCADE,
  FOREIGN KEY (confirmado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Gastos logística
CREATE TABLE IF NOT EXISTS logistica_gastos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  concepto VARCHAR(255) NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  vehiculo_id INT,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  observaciones TEXT,
  barrio_id INT,
  FOREIGN KEY (vehiculo_id) REFERENCES logistica_vehiculos(id) ON DELETE SET NULL,
  FOREIGN KEY (barrio_id) REFERENCES seccio(codigo_sec) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Incidencias
CREATE TABLE IF NOT EXISTS incidencias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  veedor_id INT DEFAULT NULL,
  tipo VARCHAR(50) DEFAULT 'incidente',
  descripcion TEXT DEFAULT NULL,
  lat DECIMAL(10,8) DEFAULT NULL,
  lng DECIMAL(11,8) DEFAULT NULL,
  foto_url VARCHAR(255) DEFAULT NULL,
  audio_url VARCHAR(255) DEFAULT NULL,
  barrio_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (veedor_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (barrio_id) REFERENCES seccio(codigo_sec) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Presupuestos Campaña
CREATE TABLE IF NOT EXISTS camp_presupuestos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  monto_total BIGINT NOT NULL DEFAULT 0,
  color VARCHAR(50) DEFAULT 'blue',
  descripcion TEXT DEFAULT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT DEFAULT NULL,
  FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Gastos Campaña
CREATE TABLE IF NOT EXISTS camp_gastos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  presupuesto_id INT DEFAULT NULL,
  categoria VARCHAR(255) NOT NULL,
  monto BIGINT NOT NULL,
  descripcion TEXT DEFAULT NULL,
  responsable_id INT DEFAULT NULL,
  responsable_nombre VARCHAR(255) DEFAULT NULL,
  fecha DATE DEFAULT NULL,
  hora TIME DEFAULT NULL,
  foto_url TEXT DEFAULT NULL,
  lat DECIMAL(10,8) DEFAULT NULL,
  lng DECIMAL(11,8) DEFAULT NULL,
  observaciones TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (presupuesto_id) REFERENCES camp_presupuestos(id) ON DELETE SET NULL,
  FOREIGN KEY (responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Caja Campaña
CREATE TABLE IF NOT EXISTS camp_caja (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo VARCHAR(255) NOT NULL,
  monto BIGINT NOT NULL,
  descripcion TEXT DEFAULT NULL,
  responsable_id INT DEFAULT NULL,
  responsable_nombre VARCHAR(255) DEFAULT NULL,
  destinatario_nombre VARCHAR(255) DEFAULT NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  observaciones TEXT DEFAULT NULL,
  FOREIGN KEY (responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Vehículos Campaña
CREATE TABLE IF NOT EXISTS camp_vehiculos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  placa VARCHAR(255) DEFAULT NULL,
  modelo VARCHAR(255) DEFAULT NULL,
  chofer VARCHAR(255) DEFAULT NULL,
  telefono VARCHAR(255) DEFAULT NULL,
  capacidad INT DEFAULT 5,
  combustible INT DEFAULT 100,
  estado VARCHAR(255) DEFAULT 'disponible',
  observaciones TEXT DEFAULT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. Tareas Campaña
CREATE TABLE IF NOT EXISTS camp_tareas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT DEFAULT NULL,
  tipo VARCHAR(255) DEFAULT NULL,
  asignado_nombre VARCHAR(255) DEFAULT NULL,
  vehiculo_id INT DEFAULT NULL,
  estado VARCHAR(255) DEFAULT 'pendiente',
  prioridad VARCHAR(255) DEFAULT 'normal',
  tiempo_estimado INT DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (vehiculo_id) REFERENCES camp_vehiculos(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. Actividades Campaña
CREATE TABLE IF NOT EXISTS camp_actividades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo VARCHAR(255) NOT NULL,
  descripcion TEXT DEFAULT NULL,
  categoria VARCHAR(255) DEFAULT NULL,
  vehiculo_id INT DEFAULT NULL,
  responsable_id INT DEFAULT NULL,
  responsable_nombre VARCHAR(255) DEFAULT NULL,
  lat DECIMAL(10,8) DEFAULT NULL,
  lng DECIMAL(11,8) DEFAULT NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehiculo_id) REFERENCES camp_vehiculos(id) ON DELETE SET NULL,
  FOREIGN KEY (responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. Log de Sincronización
CREATE TABLE IF NOT EXISTS sync_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tabla VARCHAR(50) NOT NULL,
  operacion VARCHAR(20) NOT NULL,
  payload JSON DEFAULT NULL,
  device_id VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
