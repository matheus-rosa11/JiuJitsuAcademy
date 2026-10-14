"use client";

import { ScanFace } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { deleteFace, FaceApiError, getFaceProfile, type FaceProfile } from "@/lib/faces";
import { useToast } from "./Toast";
import { Badge, Button, buttonClass, Card } from "./ui";

export function FaceProfileCard({ studentId, studentName }: { studentId: string; studentName: string }) {
  const toast = useToast();
  const [profile, setProfile] = useState<FaceProfile | null | undefined>(undefined);
  const [unavailable, setUnavailable] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    try {
      setProfile(await getFaceProfile(studentId));
      setUnavailable(false);
    } catch (error) {
      if (error instanceof FaceApiError && error.status === 404) {
        setProfile(null);
        setUnavailable(false);
        return;
      }
      setProfile(null);
      setUnavailable(true);
    }
  }, [studentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function remove() {
    if (!confirm(`Remover o cadastro facial de ${studentName}?`)) return;
    setRemoving(true);
    try {
      await deleteFace(studentId);
      toast("Cadastro facial removido.");
      setProfile(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível remover.", "error");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
          <ScanFace className="size-5" />
        </div>
        <div>
          <p className="font-semibold text-zinc-900">Cadastro facial</p>
          {profile === undefined ? (
            <p className="text-sm text-zinc-500">Verificando...</p>
          ) : unavailable ? (
            <p className="text-sm text-zinc-500">Cadastro facial indisponível no momento.</p>
          ) : profile ? (
            <div className="mt-1 flex items-center gap-2">
              <Badge tone="green">Rosto cadastrado</Badge>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Rosto ainda não cadastrado.</p>
          )}
        </div>
      </div>
      {!unavailable && profile !== undefined && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/alunos/${studentId}/rosto`} className={buttonClass({ variant: profile ? "secondary" : "primary" })}>
            {profile ? "Refazer cadastro facial" : "Cadastrar meu rosto"}
          </Link>
          {profile && (
            <Button variant="danger" onClick={() => void remove()} loading={removing}>
              Remover
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
