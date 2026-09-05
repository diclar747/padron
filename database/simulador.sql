-- ============================================================
-- Simulador de Voto — tabla de votos simulados (straw poll)
-- Elecciones Municipales 2026 · Distrito de Bella Vista
-- NO OFICIAL. No se pide cédula: el anti-doble-voto es por
-- dispositivo (device_id). Los resultados públicos son agregados.
-- ============================================================

CREATE TABLE IF NOT EXISTS simulador_votos (
  id                    SERIAL PRIMARY KEY,
  ci                    VARCHAR(30)  DEFAULT NULL,
  nombre                VARCHAR(255) DEFAULT NULL,
  distrito              VARCHAR(120) DEFAULT 'BELLA VISTA',
  en_padron             BOOLEAN      DEFAULT false,
  mesa                  INTEGER      DEFAULT NULL,
  local_voto            VARCHAR(255) DEFAULT NULL,

  intendente_lista      VARCHAR(20)  DEFAULT NULL,   -- '1' | 'BLANCO'
  intendente_candidato  VARCHAR(255) DEFAULT NULL,

  junta_lista           VARCHAR(20)  DEFAULT NULL,   -- '1' | 'BLANCO'
  junta_preferencia     INTEGER      DEFAULT NULL,   -- 1..N | NULL
  junta_candidato       VARCHAR(255) DEFAULT NULL,

  device_id             VARCHAR(64)  DEFAULT NULL,
  user_agent            VARCHAR(255) DEFAULT NULL,
  ip                    VARCHAR(64)  DEFAULT NULL,
  created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Instalaciones previas: la cédula ya no es obligatoria para votar.
ALTER TABLE simulador_votos ALTER COLUMN ci DROP NOT NULL;

-- Un voto por dispositivo (restricción de doble voto). Reemplaza la
-- restricción anterior por cédula.
DROP INDEX IF EXISTS ux_simulador_votos_ci;
CREATE UNIQUE INDEX IF NOT EXISTS ux_simulador_votos_device ON simulador_votos (device_id);
CREATE INDEX IF NOT EXISTS ix_simulador_votos_created ON simulador_votos (created_at);
