"use client";

import { ErrorState } from "@/components/ui";

export default function Error({ retry }: { error: Error; retry: () => void }) {
  return <ErrorState message="Algo deu errado ao carregar esta página." onRetry={retry} />;
}
