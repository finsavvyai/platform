import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      navigate('/', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent
                        rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400 text-sm">Authenticating...</p>
      </div>
    </div>
  );
}
