import type { Metadata } from "next";
import QuizPrestamosPy from "@/components/QuizPrestamosPy";

export const metadata: Metadata = {
  title: "Quiz de préstamos Paraguay",
  description: "Encontrá la mejor opción de préstamo para vos en Paraguay.",
};

export default function QuizPrestamosPyPage() {
  return <QuizPrestamosPy />;
}
