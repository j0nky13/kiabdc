import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function FinishLogin() {
  const { completeMagicFromUrl, user, loading } = useAuth();
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const triedRef = useRef(false);
  const navigate = useNavigate();

  const emailHint = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('e') || localStorage.getItem('emailForSignIn') || '';
    } catch {
      return '';
    }
  }, []);

  useEffect(() => {
    if (triedRef.current) return;
    triedRef.current = true;

    const go = async () => {
      setStatus('working');
      setMessage('Completing sign-in…');

      try {
        await completeMagicFromUrl();
        setStatus('done');
        setMessage('Signed in! Redirecting…');
      } catch (err) {
        console.error('completeMagicFromUrl error:', err);
        setStatus('error');
        let m = err?.message || 'Unknown error';
        if (m.includes('invalid-action-code')) m = 'This link was already used or expired.';
        else if (m.includes('Missing email')) m = 'Missing email for sign-in. Try requesting a new link.';
        setMessage(m);
      }
    };
    go();
  }, [completeMagicFromUrl]);

  useEffect(() => {
    if (status === 'done' && !loading && user) {
      navigate('/dashboard/overview', { replace: true });
    }
  }, [status, loading, user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6 text-center">
        <h1 className="text-xl font-semibold mb-2">KIA — BDC Portal</h1>
        {status === 'working' && <p>{message}</p>}
        {status === 'done' && <p>{message}</p>}
        {status === 'error' && (
          <>
            <p className="text-red-400">{message}</p>
            <Link to="/" className="underline">Go Back</Link>
          </>
        )}
      </div>
    </div>
  );
}