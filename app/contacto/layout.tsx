import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacto",
};

export default function ContactoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
