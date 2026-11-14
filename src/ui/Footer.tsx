import { clearState, defaultState, state } from '../state/store';

function eraseData(): void {
  if (!window.confirm('Apagar todos os dados salvos neste aparelho? Isso não pode ser desfeito.')) return;
  try { clearState(localStorage); } catch { /* storage unavailable */ }
  state.value = defaultState();
}

export function Footer() {
  return (
    <footer class="footer">
      <div>Ferramenta não oficial — confira sempre no portal do ICEV.</div>
      <button type="button" class="footer-erase" onClick={eraseData}>Apagar meus dados</button>
    </footer>
  );
}
