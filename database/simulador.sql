-- ============================================================
-- Simulador de Voto — tabla de votos simulados (straw poll)
-- Elecciones Municipales 2026 · Distrito de Bella Vista
-- NO OFICIAL. La cédula se guarda sólo para impedir el doble voto
-- y para el análisis interno de la campaña. Los resultados públicos
-- son siempre agregados.
-- ============================================================

CREATE TABLE IF NOT EXISTS simulador_votos (
  id                    SERIAL PRIMARY KEY,
  ci                    VARCHAR(30)  NOT NULL,
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

-- Un voto por cédula (restricción de doble voto)
CREATE UNIQUE INDEX IF NOT EXISTS ux_simulador_votos_ci ON simulador_votos (ci);
CREATE INDEX IF NOT EXISTS ix_simulador_votos_created ON simulador_votos (created_at);
