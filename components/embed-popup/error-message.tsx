import { EmbedErrorDetails } from "@/lib/types";

interface ErrorMessageProps {
  error: EmbedErrorDetails | null;
  sandboxId?: string; // Next.js server URL to load assets from (not used anymore but kept for API compatibility)
}

export function ErrorMessage({ error }: ErrorMessageProps) {
  if (!error) {
    return null;
  }

  return (
    <div className="flex w-full flex-col justify-center gap-2 px-4 py-3 text-center">
      <span className="leading-tight font-medium text-pretty">
        {error.title}
      </span>
      <span className="text-sm text-balance">{error.description}</span>
    </div>
  );
}
