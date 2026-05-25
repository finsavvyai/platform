import React from 'react';

export const LoadingState: React.FC = () => (
  <div className="flex justify-center items-center h-64"
    role="status" aria-label="Loading entity">
    <div className="motion-safe:animate-spin h-8 w-8 border-2 border-blue-500
      border-t-transparent rounded-full" />
    <span className="sr-only">Loading entity</span>
  </div>
);

export const ErrorState: React.FC<{ message: string; onBack: () => void }> = ({
  message, onBack,
}) => (
  <div className="max-w-md mx-auto mt-16 text-center">
    <p className="text-red-600 dark:text-red-400 mb-4">{message || 'Entity not found'}</p>
    <button onClick={onBack}
      className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 rounded">
      Go back
    </button>
  </div>
);
