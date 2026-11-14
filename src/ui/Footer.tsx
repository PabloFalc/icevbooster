import { clearState, defaultState, state } from '../state/store';

function eraseData(): void {
  if (!window.confirm('Apagar todos os dados salvos neste aparelho? Isso não pode ser desfeito.')) return;
  // Reset the signal first: its persistence effect rewrites defaults, then clearState removes the key.
  state.value = defaultState();
  clearState(localStorage);
}

export function Footer() {
  return (
    <footer class="footer">
      <div>Ferramenta não oficial — confira sempre no portal do ICEV.</div>
      <button type="button" class="footer-erase" onClick={eraseData}>Apagar meus dados</button>
    </footer>
  );
}
