import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { suppressCaughtErrorLogging } from './app/error-handlers';
import { startTheme } from './shared/lib/theme';
// Before the first render, so the first paint already has the viewer's scheme (ADR-053 §6).
startTheme();
createRoot(document.getElementById('root')!, { onCaughtError: suppressCaughtErrorLogging, onUncaughtError: () => {} }).render(<App />);
