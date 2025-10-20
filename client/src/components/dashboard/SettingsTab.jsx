import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

const LS_THEME = 'bdc.theme'; // 'light' | 'dark'

export default function SettingsTab() {
  const { user, updateProfile } = useAuth();
  const [theme, setTheme] = useState('dark'); // default dark
  const [name, setName] = useState(user?.name || '');

  // Read persisted theme
  useEffect(() => {
    const saved = localStorage.getItem(LS_THEME);
    if (saved === 'light' || saved === 'dark') {
      applyTheme(saved);
      setTheme(saved);
    } else {
      applyTheme('dark');
      setTheme('dark');
    }
  }, []);

  const applyTheme = (mode) => {
    const root = document.documentElement;
    if (mode === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem(LS_THEME, mode);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  const saveName = async () => {
    if (!name.trim()) return;
    await updateProfile({ name: name.trim() });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/20 bg-white/10 dark:bg-neutral-900/20 backdrop-blur-xl p-6">
        <h2 className="text-lg font-semibold mb-3">Appearance</h2>
        <button
          onClick={toggleTheme}
          className="px-4 py-2 rounded-xl border border-white/30 hover:bg-white/20"
        >
          Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
        </button>
      </div>

      <div className="rounded-2xl border border-white/20 bg-white/10 dark:bg-neutral-900/20 backdrop-blur-xl p-6">
        <h2 className="text-lg font-semibold mb-3">Profile</h2>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label className="text-xs opacity-80">Display Name</label>
            <input
              className="mt-1 w-full px-3 py-2 rounded-xl border border-white/30 bg-white/40 dark:bg-neutral-800/40"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name as shown in greeting"
            />
          
          </div>
          <button
            onClick={saveName}
            className="px-4 py-2 rounded-xl border border-white/30 hover:bg-white/20"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}