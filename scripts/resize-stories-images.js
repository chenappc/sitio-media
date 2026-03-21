/**
 * Redimensiona imágenes de story_paginas en Cloudinary (máx. 550px alto) y actualiza la DB.
 * Uso: node scripts/resize-stories-images.js
 *
 * Requiere: DATABASE_URL, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 * (cargados desde .env.local / .env vía dotenv)
 *
 * Si falta sharp: npm install sharp
 */
const path = require("path");
const { execSync } = require("child_process");

function ensureSharp() {
  try {
    require.resolve("sharp");
  } catch {
    console.log("sharp no encontrado; ejecutando: npm install sharp");
    execSync("npm install sharp", { stdio: "inherit", cwd: path.join(__dirname, "..") });
  }
}

ensureSharp();

const sharp = require("sharp");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { Pool } = require("pg");
const cloudinary = require("cloudinary").v2;

// Misma configuración que lib/db.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

if (!process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_URL) {
  const match = process.env.CLOUDINARY_URL.match(/cloudinary:\/\/(\w+):(\w+)@(\w+)/);
  if (match) {
    process.env.CLOUDINARY_API_KEY = match[1];
    process.env.CLOUDINARY_API_SECRET = match[2];
    process.env.CLOUDINARY_CLOUD_NAME = match[3];
  }
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Extrae public_id (sin extensión) de una URL de Cloudinary.
 */
function publicIdFromCloudinaryUrl(url) {
  const clean = String(url).split("?")[0];
  const idx = clean.indexOf("/upload/");
  if (idx === -1) return null;
  const rest = clean.slice(idx + "/upload/".length);
  const segments = rest.split("/").filter(Boolean);
  let start = 0;
  while (start < segments.length && segments[start].includes(",")) {
    start++;
  }
  if (start < segments.length && /^v\d+$/i.test(segments[start])) {
    start++;
  }
  if (start >= segments.length) return null;
  const pathParts = segments.slice(start);
  const last = pathParts[pathParts.length - 1];
  pathParts[pathParts.length - 1] = last.replace(/\.[^.]+$/, "");
  return pathParts.join("/");
}

async function resizeBuffer(inputBuffer) {
  const meta = await sharp(inputBuffer).metadata();
  const pipeline = sharp(inputBuffer).resize({
    height: 550,
    fit: "inside",
    withoutEnlargement: true,
  });
  const fmt = meta.format;
  if (fmt === "jpeg" || fmt === "jpg") {
    return pipeline.jpeg({ quality: 88 }).toBuffer();
  }
  if (fmt === "png") {
    return pipeline.png({ compressionLevel: 9 }).toBuffer();
  }
  if (fmt === "webp") {
    return pipeline.webp({ quality: 85 }).toBuffer();
  }
  return pipeline.webp({ quality: 85 }).toBuffer();
}

function dataUriForBuffer(buf, mime) {
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Falta DATABASE_URL");
    process.exit(1);
  }
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("Faltan variables de Cloudinary");
    process.exit(1);
  }

  const { rows } = await pool.query(
    `SELECT id, imagen_url FROM story_paginas
     WHERE imagen_url IS NOT NULL AND imagen_url ILIKE '%cloudinary%'
     ORDER BY id`
  );

  const total = rows.length;
  console.log(`Encontradas ${total} filas con imagen_url en Cloudinary.`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const oldUrl = row.imagen_url;
    const n = i + 1;
    console.log(`Procesando imagen ${n} de ${total}: [${oldUrl}]`);

    const publicId = publicIdFromCloudinaryUrl(oldUrl);
    if (!publicId) {
      console.warn(`  No se pudo extraer public_id, se omite.`);
      continue;
    }

    try {
      const res = await fetch(oldUrl);
      if (!res.ok) {
        console.warn(`  Error descargando HTTP ${res.status}, se omite.`);
        continue;
      }
      const arrayBuf = await res.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuf);

      const resized = await resizeBuffer(inputBuffer);
      const metaOut = await sharp(resized).metadata();
      const mime =
        metaOut.format === "jpeg" || metaOut.format === "jpg"
          ? "image/jpeg"
          : metaOut.format === "png"
            ? "image/png"
            : metaOut.format === "webp"
              ? "image/webp"
              : "image/webp";

      const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload(
          dataUriForBuffer(resized, mime),
          {
            public_id: publicId,
            overwrite: true,
            invalidate: true,
            resource_type: "image",
          },
          (err, result) => {
            if (err) reject(err);
            else resolve(result);
          }
        );
      });

      const newUrl = uploadResult.secure_url || uploadResult.url;
      if (!newUrl) {
        console.warn(`  Upload sin URL, se omite actualización DB.`);
        continue;
      }

      await pool.query(`UPDATE story_paginas SET imagen_url = $1 WHERE id = $2`, [newUrl, row.id]);
      console.log(`  OK → ${newUrl}`);
    } catch (e) {
      console.error(`  Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await pool.end();
  console.log("Listo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
