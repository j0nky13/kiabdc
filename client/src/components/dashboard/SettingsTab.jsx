import { useState } from "react";

const LS_THEME = 'bdc.theme'; // 'light' | 'dark'

export default function SettingsTab() {
  // Read current theme from <html> class (set at boot by index.html script)
  const [theme, setTheme] = useState(() => (
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  ));

  const applyTheme = (mode) => {
    const root = document.documentElement;
    if (mode === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    try { localStorage.setItem(LS_THEME, mode); } catch {}
    root.style.colorScheme = mode === 'dark' ? 'dark' : 'light';
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/20 bg-white/10 dark:bg-neutral-900/20 backdrop-blur-xl p-6">
        <h2 className="text-lg font-semibold mb-3">Appearance</h2>
        <button
          onClick={toggleTheme}
          className="px-4 py-2 rounded-xl border border-white/30 hover:bg-white/20"
        >
          Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode (current: {theme})
        </button>
      </div>
    </div>
  );
}