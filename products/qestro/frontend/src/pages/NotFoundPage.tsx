import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '../components/atoms';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <div className="text-center max-w-md">
        <AlertTriangle
          className="w-16 h-16 mx-auto mb-6"
          style={{ color: 'var(--status-warning)' }}
        />
        <h1 className="text-6xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>404</h1>
        <p className="text-xl mb-2" style={{ color: 'var(--text-secondary)' }}>Page not found</p>
        <p className="mb-8" style={{ color: 'var(--text-muted)' }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => navigate(-1)} variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Go Back
          </Button>
          <Button onClick={() => navigate('/')}>
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
