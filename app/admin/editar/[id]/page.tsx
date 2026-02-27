import { notFound } from "next/navigation";
import { getNotaById } from "@/lib/notas";
import EditarNotaForm from "./EditarNotaForm";

type Props = { params: Promise<{ id: string }> };

export default async function EditarNotaPage({ params }: Props) {
  const { id } = await params;
  const idNum = parseInt(id, 10);
  if (Number.isNaN(idNum)) notFound();
  const nota = await getNotaById(idNum);
  if (!nota) notFound();
  return <EditarNotaForm nota={nota} />;
}
