"use client";

type Props = {
  titulo: string;
  slug: string;
  /** ej. "/en" para notas en inglés → …/en/slug */
  pathPrefix?: string;
};

export default function WhatsAppButton({
  titulo,
  slug,
  pathPrefix = "",
}: Props) {
  const path = pathPrefix + "/" + slug;
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(titulo + " " + "https://www.vahica.com" + path)}`}
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
