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
  /** es | en | original — alineado con especiales/scrape */
  idioma?: string | null;
  fecha: Date;
  created_at?: Date;
  fb_post_id?: string | null;
  fb_post_url?: string | null;
  visitas?: number;
}

export interface Story {
  id: number;
  slug: string;
  titulo: string;
  status: string;
  total_paginas: number;
  url_base?: string | null;
  descripcion_protagonista?: string | null;
  imagen_referencia_url?: string | null;
  /** es | en | original — alineado con especiales/scrape */
  idioma?: string;
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

export interface Especial {
  id: number;
  slug: string;
  titulo: string;
  status: string;
  total_paginas: number;
  url_base?: string | null;
  idioma?: string | null;
  usar_imagenes_ia?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export type Bloque =
  | { tipo: "imagen"; url: string }
  | { tipo: "parrafo"; texto: string };

export interface EspecialPagina {
  id: number;
  especial_id: number;
  numero: number;
  titulo_item?: string | null;
  imagen_url?: string | null;
  imagen_original_url?: string | null;
  parrafos: unknown[];
  bloques?: Bloque[];
  created_at?: Date;
}
