export interface Nota {
  id: number;
  slug: string;
  titulo: string;
  entradilla: string;
  cuerpo: string;
  imagen_url: string | null;
  imagen2_url: string | null;
  imagen_alt: string | null;
  fuente_nombre: string;
  fuente_url: string;
  shares_buzzsumo: number;
  pais: string;
  publicado: boolean;
  fecha: Date;
  created_at?: Date;
  fb_post_id?: string | null;
  fb_post_url?: string | null;
}

export interface Story {
  id: number;
  slug: string;
  titulo: string;
  status: string;
  total_paginas: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface StoryPagina {
  id: number;
  story_id: number;
  numero: number;
  imagen_url: string | null;
  parrafos: unknown[];
  created_at?: Date;
}
