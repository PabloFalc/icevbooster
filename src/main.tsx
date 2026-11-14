import { render } from 'preact';
import { App } from './app';
import { applyStoredTheme } from './ui/ThemeToggle';
import './ui/theme.css';

applyStoredTheme();
render(<App />, document.getElementById('app')!);
