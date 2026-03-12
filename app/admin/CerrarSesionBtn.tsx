"use client";

const STORAGE_KEY = "admin_secret";

export function clearAdminSecret() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function getAdminSecret(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

export function setAdminSecret(secret: string) {
  if (typeof window !== "undefined" && secret) {
    window.localStorage.setItem(STORAGE_KEY, secret);
  }
}

export default function CerrarSesionBtn() {
  return (
    <button
      type="button"
      onClick={() => {
        clearAdminSecret();
        window.location.href = "/admin/login";
      }}
      className="text-sm text-[var(--negro)]/50 hover:text-[var(--negro)]/80"
    >
      Cerrar sesión
    </button>
  );
}
