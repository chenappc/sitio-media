"use client";

import { useEffect } from "react";

type Props = {
  slotId: string;
  minWidth?: number;
  minHeight?: number;
};

export default function AdXSlot({ slotId, minWidth = 300, minHeight = 250 }: Props) {
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

  return <div id={slotId} style={{ minWidth, minHeight }} />;
}
