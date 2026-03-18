"use client";

import { useEffect } from "react";

type Variant = "mobile" | "desktop";

function getVariantByWidth(width: number): Variant {
  return width < 768 ? "mobile" : "desktop";
}

function getConfig(variant: Variant) {
  if (variant === "mobile") {
    return { sc_project: 13196069, sc_security: "af334f2e" };
  }
  return { sc_project: 13211414, sc_security: "7a9e7168" };
}

export default function StatCounterDual() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const variant = getVariantByWidth(window.innerWidth);
    const { sc_project, sc_security } = getConfig(variant);

    const inlineId = `statcounter-dual-inline-${variant}`;
    const srcId = `statcounter-dual-src-${variant}`;

    // Evitar duplicados si el componente se monta más de una vez.
    if (document.getElementById(inlineId) || document.getElementById(srcId)) return;

    // Quitar la otra variante si existiera.
    (["mobile", "desktop"] as Variant[])
      .filter((v) => v !== variant)
      .forEach((v) => {
        document.getElementById(`statcounter-dual-inline-${v}`)?.remove();
        document.getElementById(`statcounter-dual-src-${v}`)?.remove();
      });

    const inline = document.createElement("script");
    inline.id = inlineId;
    inline.type = "text/javascript";
    inline.text = `var sc_project=${sc_project}; var sc_invisible=1; var sc_security="${sc_security}";`;

    const src = document.createElement("script");
    src.id = srcId;
    src.type = "text/javascript";
    src.src = "https://www.statcounter.com/counter/counter.js";
    src.async = true;

    document.body.appendChild(inline);
    document.body.appendChild(src);
  }, []);

  return null;
}

