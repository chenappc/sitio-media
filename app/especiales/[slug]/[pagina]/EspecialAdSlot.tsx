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
    defineSlotIfNeededAndDisplay(numero, kind);
  }, [numero, kind]);

  return <div id={id} style={{ minWidth: 300, minHeight: 250 }} />;
}
