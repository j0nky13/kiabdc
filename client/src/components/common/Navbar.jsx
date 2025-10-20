import LogoKia from './LogoKia';

export default function NavBar() {
  return (
    <header className="w-full glass shadow-float rounded-2xl border border-white/20 dark:border-white/10 px-4 py-3 flex items-center justify-between">
      <LogoKia className="text-lg" />
      <nav className="text-sm opacity-80">BDC Portal</nav>
    </header>
  );
}