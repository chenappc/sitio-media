import type { Metadata } from "next";
import { Merriweather, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";
import AdSenseScript from "@/components/AdSenseScript";

const merriweather = Merriweather({
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  weight: ["400", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "sitio.media",
    template: "%s | sitio.media",
  },
  description: "Noticias virales en español",
  metadataBase: new URL("https://sitio.media"),
  openGraph: {
    siteName: "sitio.media",
  },
  verification: {
    other: {
      "google-adsense-account": "ca-pub-5212469313751329",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${merriweather.variable} ${sourceSans.variable}`}>
      <body>
        <LayoutShell>{children}</LayoutShell>
        <AdSenseScript />
      </body>
    </html>
  );
}
