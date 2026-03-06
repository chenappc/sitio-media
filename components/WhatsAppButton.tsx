"use client";

export default function WhatsAppButton({ titulo, slug }: { titulo: string; slug: string }) {
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(titulo + " " + "https://www.sitio.media/" + slug)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full"
      style={{
        display: "block",
        marginTop: "1.5rem",
        padding: "14px 20px",
        background: "#128c7e",
        color: "#fff",
        textAlign: "center",
        textDecoration: "none",
        fontWeight: 600,
        fontSize: "1rem",
        borderRadius: "8px",
      }}
    >
      Compartir esta nota por WhatsApp
    </a>
  );
}
