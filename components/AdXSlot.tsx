"use client";

import { useEffect } from "react";

type Props = {
  slotId: string;
  minWidth?: number;
  /** Muestra el rótulo centrado encima del slot (estilo secundario, discreto). */
  showLabel?: boolean;
  locale?: "es" | "en";
};

export default function AdXSlot({
  slotId,
  minWidth = 300,
  showLabel = false,
  locale = "es",
}: Props) {
  useEffect(() => {
    try {
      (window as unknown as { googletag?: { cmd: { push: (fn: () => void) => void } } }).googletag?.cmd.push(
        function () {
          (window as unknown as { googletag?: { display: (id: string) => void } }).googletag?.display(
            slotId
          );
        }
      );
    } catch {
      /* ignore */
    }
  }, [slotId]);

  const slot = <div id={slotId} style={{ minWidth }} />;

  if (!showLabel) {
    return slot;
  }

  const labelText = locale === "en" ? "-- ADVERTISEMENT --" : "-- ANUNCIO --";
  return (
    <div className="flex w-full flex-col items-center">
      <p className="mb-2 text-center text-xs font-normal text-[#aaaaaa]">{labelText}</p>
      {slot}
    </div>
  );
}
