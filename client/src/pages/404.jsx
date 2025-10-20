

import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-10 text-center max-w-md shadow-xl">
        <h1 className="text-6xl font-bold mb-4 text-sky-400">404</h1>
        <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
        <p className="text-slate-300 mb-6">
          The page you’re looking for doesn’t exist or has been moved.
        </p>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 mx-auto px-6 py-3 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium transition-all duration-200"
        >
          <ArrowLeft size={18} />
          Go Back Home
        </button>
      </div>
    </div>
  );
}