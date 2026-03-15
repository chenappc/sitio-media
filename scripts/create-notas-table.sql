-- Tabla de notas para Vahica.com
-- Ejecutar en PostgreSQL (Railway o local)

CREATE TABLE IF NOT EXISTS notas (
  id         SERIAL PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  titulo     TEXT NOT NULL,
  entradilla TEXT NOT NULL,
  cuerpo     TEXT NOT NULL,
  imagen_url TEXT,
  imagen_alt TEXT,
  fuente_nombre TEXT NOT NULL,
  fuente_url  TEXT NOT NULL,
  shares_buzzsumo INTEGER NOT NULL DEFAULT 0,
  pais       TEXT NOT NULL DEFAULT 'general',
  publicado  BOOLEAN NOT NULL DEFAULT false,
  fecha      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notas_publicado_fecha ON notas (publicado, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_notas_slug ON notas (slug);
