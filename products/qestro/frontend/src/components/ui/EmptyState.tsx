import { FileQuestion } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../atoms';

export interface EmptyStateProps {
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string; // Added className prop for flexibility
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    actionLabel,
    onAction,
    className
}) => {
    return (
        <div className={cn("flex flex-col items-center justify-center py-16 px-4", className)}>
            <div className="bg-gray-100 rounded-full p-6 mb-6"> {/** Changed bg-gray-800 to bg-gray-100 for light mode compatibility default, or make it neutral */}
                <FileQuestion className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3> {/** text-white -> text-gray-900 for Light mode default */}
            <p className="text-gray-500 text-center max-w-md mb-6">{description}</p>
            {actionLabel && onAction && (
                <Button
                    onClick={onAction}
                    variant="primary"
                >
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}

