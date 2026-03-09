import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { Readable } from "stream";

async function uploadBufferToCloudinary(buf: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (err, result) => {
        if (err) reject(err);
        else resolve(result!.secure_url);
      }
    );
    Readable.from(buf).pipe(uploadStream);
  });
}

async function generarDalle(prompt: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
      }),
    });
    const data = await res.json();
    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) return null;
    const imgRes = await fetch(imageUrl);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    return await uploadBufferToCloudinary(buf, "sitio-media/test");
  } catch {
    return null;
  }
}

async function generarGemini(prompt: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      }
    );
    const data = await res.json();
    console.log("GEMINI RESPONSE:", JSON.stringify(data).slice(0, 500));
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));
    if (!imagePart) return null;
    const buf = Buffer.from(imagePart.inlineData.data, "base64");
    return await uploadBufferToCloudinary(buf, "sitio-media/test");
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt) return NextResponse.json({ error: "Prompt requerido" }, { status: 400 });

    const [dalle_url, gemini_url] = await Promise.all([
      Promise.race([
        generarDalle(prompt),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 60000)),
      ]),
      Promise.race([
        generarGemini(prompt),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 60000)),
      ]),
    ]);

    console.log("DALLE URL:", dalle_url);
    console.log("GEMINI URL:", gemini_url);

    return NextResponse.json({ dalle_url, gemini_url });
  } catch (err) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
