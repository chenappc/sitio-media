"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getAdminSecret } from "./CerrarSesionBtn";

export default function CandidatosLink() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const secret = getAdminSecret();
    if (!secret) {
      setCount(0);
      return;
    }
    fetch("/api/candidatos?count=true", {
      headers: { "x-admin-secret": secret },
    })
      .then((res) => (res.ok ? res.json() : { count: 0 }))
      .then((data) => setCount(typeof data?.count === "number" ? data.count : 0))
      .catch(() => setCount(0));
  }, []);

  return (
    <Link
      href="/admin/candidatos"
      className="rounded border border-[var(--negro)]/30 px-4 py-2 text-sm font-semibold text-[var(--negro)] hover:bg-[var(--negro)]/5"
    >
      Candidatos via API ({count !== null ? count : "…"})
    </Link>
  );
}
