import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://sitio.media",
      lastModified: new Date(),
    },
    {
      url: "https://sitio.media/quiz-prestamos-py",
      lastModified: new Date(),
    },
    {
      url: "https://sitio.media/prestamos-paraguay",
      lastModified: new Date(),
    },
    {
      url: "https://sitio.media/solicitar-prestamo-paraguay",
      lastModified: new Date(),
    },
  ];
}
