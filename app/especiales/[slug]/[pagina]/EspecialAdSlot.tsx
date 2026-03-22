"use client";

import { useEffect } from "react";
import { defineSlotIfNeededAndDisplay, getSlotId } from "@/lib/gpt-especiales";

export default function EspecialAdSlot({
  numero,
  kind,
}: {
  numero: number;
  kind: "top" | "bottom";
}) {
  const id = getSlotId(numero, kind);

  useEffect(() => {
    const timer = setTimeout(() => {
      defineSlotIfNeededAndDisplay(numero, kind);
    }, 100);
    return () => clearTimeout(timer);
  }, [numero, kind]);

  return <div id={id} />;
}
