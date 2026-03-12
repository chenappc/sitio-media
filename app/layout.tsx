import type { Metadata } from "next";
import Script from "next/script";
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
      <head>
        <AdSenseScript />
      </head>
      <body>
        <LayoutShell>{children}</LayoutShell>
        <Script id="statcounter" strategy="afterInteractive">
          {`var sc_project=13196069; var sc_invisible=1; var sc_security="af334f2e";`}
        </Script>
        <Script
          src="https://www.statcounter.com/counter/counter.js"
          strategy="afterInteractive"
          async
        />
        <noscript>
          <div className="statcounter">
            <a title="Web Analytics" href="https://statcounter.com/" target="_blank" rel="noreferrer">
              <img
                className="statcounter"
                src="https://c.statcounter.com/13196069/0/af334f2e/1/"
                alt="Web Analytics"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </a>
          </div>
        </noscript>
      </body>
    </html>
  );
}
