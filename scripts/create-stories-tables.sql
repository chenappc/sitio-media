-- Tablas para Stories (Vahica.com)
-- Ejecutar en PostgreSQL (Railway o local)

CREATE TABLE IF NOT EXISTS stories (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  total_paginas INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS story_paginas (
  id SERIAL PRIMARY KEY,
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  imagen_url TEXT,
  parrafos JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(story_id, numero)
);
