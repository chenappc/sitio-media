import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://vahica.com",
      lastModified: new Date(),
    },
    {
      url: "https://vahica.com/quiz-prestamos-py",
      lastModified: new Date(),
    },
    {
      url: "https://vahica.com/prestamos-paraguay",
      lastModified: new Date(),
    },
    {
      url: "https://vahica.com/solicitar-prestamo-paraguay",
      lastModified: new Date(),
    },
  ];
}
