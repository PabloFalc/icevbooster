import { useState } from 'preact/hooks';

type Phase = 'idle' | 'reading' | 'error';

/** A failure whose message is shown to the student instead of the default failure copy. */
export class UploadError extends Error {}

/**
 * Print picker. The file is handed to `onFile` (OCR runs locally in the browser); it is never sent anywhere.
 * While `onFile` runs the card shows "Lendo o print…"; a rejection shows the failure copy (an UploadError shows its own message).
 */
export function Upload({ label, accept, onFile, hint = 'Tire o print com a tabela completa visível — todas as linhas e colunas.', errorText = 'Não consegui ler esse print. Tente outro print ou preencha manualmente.' }: {
  label: string; accept: string; onFile(f: File): Promise<void>; hint?: string; errorText?: string;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState(errorText);

  async function onChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setPhase('reading');
    try {
      await onFile(file);
      setPhase('idle');
    } catch (err) {
      setMessage(err instanceof UploadError ? err.message : errorText);
      setPhase('error');
    }
  }

  return (
    <div class="upload">
      <label class={`upload-btn${phase === 'reading' ? ' busy' : ''}`}>
        <input type="file" accept={accept} onChange={onChange} disabled={phase === 'reading'} />
        {label}
      </label>
      <p class="upload-hint">{hint}</p>
      {phase === 'reading' && (
        <p class="upload-status" role="status">
          <progress aria-label="Lendo o print" />
          Lendo o print…
        </p>
      )}
      {phase === 'error' && <p class="upload-error" role="alert">{message}</p>}
    </div>
  );
}
