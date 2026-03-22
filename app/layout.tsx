import type { Metadata } from "next";
import Script from "next/script";
import { Merriweather, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";
import StatCounterDual from "@/components/StatCounterDual";

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
    default: "Vahica.com",
    template: "%s | Vahica.com",
  },
  description: "Noticias virales en español. Vahica.com",
  metadataBase: new URL("https://vahica.com"),
  openGraph: {
    siteName: "Vahica.com",
  },
  icons: {
    icon: ["/favicon.ico", "/favicon.png"],
  },
};

const GPT_INIT = `
  window.googletag = window.googletag || { cmd: [] };
  googletag.cmd.push(function () {
    var responsiveMapping = googletag.sizeMapping()
      .addSize([1024, 0], [[970, 250], [970, 90], [728, 90], [336, 280], [300, 250]])
      .addSize([768, 0], [[728, 90], [336, 280], [300, 250]])
      .addSize([0, 0], [[300, 250]])
      .build();

    googletag.defineSlot('/186299052/Vahica.com/Vahica_Single_Top', [[970, 250], [970, 90], [728, 90], [336, 280], [300, 250]], 'div-gpt-ad-1774066671869-0')
      .defineSizeMapping(responsiveMapping).addService(googletag.pubads());

    googletag.defineSlot('/186299052/Vahica.com/Vahica_Single_Middle', [[970, 250], [970, 90], [728, 90], [336, 280], [300, 250]], 'div-gpt-ad-1774066837194-0')
      .defineSizeMapping(responsiveMapping).addService(googletag.pubads());

    googletag.defineSlot('/186299052/Vahica.com/Vahica_Single_Bottom', [[970, 250], [970, 90], [728, 90], [336, 280], [300, 250]], 'div-gpt-ad-1774066088689-0')
      .defineSizeMapping(responsiveMapping).addService(googletag.pubads());

    googletag.defineSlot('/186299052/Vahica.com/Vahica_Single_Left', [300, 600], 'gpt-vahica-single-left').addService(googletag.pubads());
    googletag.defineSlot('/186299052/Vahica.com/Vahica_Single_Right', [300, 600], 'gpt-vahica-single-right').addService(googletag.pubads());
    googletag.defineSlot('/186299052/Vahica.com/Vahica_Single_Horizontal', [728, 90], 'div-gpt-ad-1774064935710-0').addService(googletag.pubads());
    // googletag.defineSlot('/186299052/Vahica.com/Vahica_Interstitial', [[336, 280], [300, 250], [320, 480]], 'div-gpt-ad-1773725445265-0').addService(googletag.pubads());
    googletag.pubads().enableSingleRequest();
    googletag.enableServices();
  });
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${merriweather.variable} ${sourceSans.variable}`}>
      <head>
        <Script
          src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"
          strategy="beforeInteractive"
          crossOrigin="anonymous"
        />
        <Script id="gpt-vahica-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: GPT_INIT }} />
      </head>
      <body>
        <LayoutShell>{children}</LayoutShell>
        <StatCounterDual />
      </body>
    </html>
  );
}
