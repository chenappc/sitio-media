"use client";

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "ca-pub-5212469313751329";

export default function AdSense() {
  if (!CLIENT) return null;

  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={CLIENT}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
