import { useState } from 'preact/hooks';

type Phase = 'idle' | 'reading' | 'error';

/**
 * Print picker. The file is handed to `onFile` (OCR runs locally in the browser); it is never sent anywhere.
 * While `onFile` runs the card shows "Lendo o print…"; a rejection shows the failure copy.
 */
export function Upload({ label, accept, onFile }: { label: string; accept: string; onFile(f: File): Promise<void> }) {
  const [phase, setPhase] = useState<Phase>('idle');

  async function onChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setPhase('reading');
    try {
      await onFile(file);
      setPhase('idle');
    } catch {
      setPhase('error');
    }
  }

  return (
    <div class="upload">
      <label class={`upload-btn${phase === 'reading' ? ' busy' : ''}`}>
        <input type="file" accept={accept} onChange={onChange} disabled={phase === 'reading'} />
        {label}
      </label>
      <p class="upload-hint">Tire o print com a tabela completa visível — todas as linhas e colunas.</p>
      {phase === 'reading' && (
        <p class="upload-status" role="status">
          <progress aria-label="Lendo o print" />
          Lendo o print…
        </p>
      )}
      {phase === 'error' && <p class="upload-error" role="alert">Não consegui ler esse print. Tente outro print ou preencha manualmente.</p>}
    </div>
  );
}
