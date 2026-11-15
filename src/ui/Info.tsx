/**
 * Small "i" dot that shows its text on hover or keyboard focus, so explanations don't fill the page.
 * `tone` colors the dot (amber = attention, red = problem).
 */
export function Info({ text, tone }: { text: string; tone?: 'warn' | 'bad' }) {
  return (
    <span class={`info${tone ? ` ${tone}` : ''}`} tabIndex={0} role="note" aria-label={text} data-tip={text}>i</span>
  );
}
