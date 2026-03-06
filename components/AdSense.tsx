"use client";

import { useEffect, useRef } from "react";

// const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "ca-pub-5212469313751329";
const CLIENT = "ca-pub-5594467574381530";

type AdSenseProps = {
  slot?: string;
};

// const DEFAULT_SLOT = "8857811296";
const DEFAULT_SLOT = "7922354756";

export default function AdSense({ slot = DEFAULT_SLOT }: AdSenseProps) {
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!slot || !CLIENT || !insRef.current) return;
    try {
      ((window as unknown) as { adsbygoogle?: unknown[] }).adsbygoogle =
        ((window as unknown) as { adsbygoogle?: unknown[] }).adsbygoogle || [];
      ((window as unknown) as { adsbygoogle: unknown[] }).adsbygoogle.push({});
    } catch {
      // ignore
    }
  }, [slot]);

  if (!slot || !CLIENT) return null;

  return (
    <ins
      ref={insRef}
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
