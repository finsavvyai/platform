import React from 'react';
import { LoadingSpinner } from '../atoms';

export const PageLoader: React.FC = () => {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <LoadingSpinner size="lg" />
        </div>
    );
};
