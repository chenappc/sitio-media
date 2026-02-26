"use client";

import { useEffect } from "react";

const ADSENSE_SRC =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5212469313751329";

export default function AdSenseScript() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.querySelector(`script[src="${ADSENSE_SRC}"]`)) return;

    const script = document.createElement("script");
    script.src = ADSENSE_SRC;
    script.async = true;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
  }, []);

  return null;
}
