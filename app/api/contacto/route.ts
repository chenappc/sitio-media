import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");
const TO_EMAIL = "chenappc@gmail.com";
const FROM_EMAIL = process.env.RESEND_FROM ?? "Vahica.com <onboarding@resend.dev>";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, email, mensaje } = body;

    if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
      return NextResponse.json(
        { error: "Falta el nombre" },
        { status: 400 }
      );
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { error: "Falta el email" },
        { status: 400 }
      );
    }
    if (!mensaje || typeof mensaje !== "string" || !mensaje.trim()) {
      return NextResponse.json(
        { error: "Falta el mensaje" },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY no configurada");
      return NextResponse.json(
        { error: "El servicio de contacto no está configurado" },
        { status: 503 }
      );
    }

    const subject = `Contacto Vahica.com - ${nombre.trim()}`;
    const textContent = `Nombre: ${nombre.trim()}\nEmail: ${email.trim()}\n\nMensaje:\n${mensaje.trim()}`;
    const htmlContent = `
      <p><strong>Nombre:</strong> ${escapeHtml(nombre.trim())}</p>
      <p><strong>Email:</strong> ${escapeHtml(email.trim())}</p>
      <p><strong>Mensaje:</strong></p>
      <p>${escapeHtml(mensaje.trim()).replace(/\n/g, "<br>")}</p>
    `.trim();

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      subject,
      text: textContent,
      html: htmlContent,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { error: "No se pudo enviar el mensaje. Intentá de nuevo más tarde." },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al enviar" },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
