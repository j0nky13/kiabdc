import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { sendMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [sentTo, setSentTo] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus('');
    setSentTo('');
    try {
      await sendMagicLink(email);
      setSentTo(email);
      setStatus('sent');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="w-full max-w-md p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl text-center">
        {status === 'sent' ? (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold text-green-400">Link Sent!</h1>
            <p className="text-sm opacity-80">
              A secure login link has been sent to:
            </p>
            <p className="text-white font-medium">{sentTo}</p>
            <p className="text-sm opacity-70 leading-relaxed">
              Click the link in your email to access your dashboard.  
              Be sure to check your <strong>Spam</strong> or <strong>Promotions</strong> folder if you
              don’t see it within a few minutes.
            </p>
            <button
              onClick={() => {
                setStatus('');
                setEmail('');
              }}
              className="mt-4 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
            >
              Send Another Link
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold mb-6">BDC Portal</h1>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-2">Work Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 outline-none"
                  placeholder="you@company.com"
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
              >
                Send Sign-in Link
              </button>
            </form>
            {status === 'error' && (
              <p className="mt-4 text-sm text-red-400">
                Something went wrong sending the link. Please try again.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}