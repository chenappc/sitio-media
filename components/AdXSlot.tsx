"use client";

import { useEffect } from "react";

type Props = {
  slotId: string;
  minWidth?: number;
  minHeight?: number;
  /** Muestra el rótulo centrado “-- ANUNCIO --” encima del slot (estilo secundario, discreto). */
  showLabel?: boolean;
};

export default function AdXSlot({
  slotId,
  minWidth = 300,
  minHeight = 250,
  showLabel = false,
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

  const slot = <div id={slotId} style={{ minWidth, minHeight }} />;

  if (!showLabel) {
    return slot;
  }

  return (
    <div className="flex w-full flex-col items-center">
      <p className="mb-2 text-center text-xs font-normal text-[#aaaaaa]">-- ANUNCIO --</p>
      {slot}
    </div>
  );
}
