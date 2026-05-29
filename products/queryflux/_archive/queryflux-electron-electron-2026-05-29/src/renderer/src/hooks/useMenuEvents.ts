import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hook to handle menu events from the main process
 */
export function useMenuEvents() {
    const navigate = useNavigate();

    useEffect(() => {
        if (!window.api) return;

        const cleanupFns: (() => void)[] = [];

        // New Query
        cleanupFns.push(
            window.api.onMenuEvent('menu:new-query', () => {
                navigate('/query');
            })
        );

        // New Connection
        cleanupFns.push(
            window.api.onMenuEvent('menu:new-connection', () => {
                navigate('/connections');
            })
        );

        // Save Query
        cleanupFns.push(
            window.api.onMenuEvent('menu:save-query', () => {
                // Dispatch custom event for query editor to handle
                window.dispatchEvent(new CustomEvent('queryflux:save-query'));
            })
        );

        // Execute Query
        cleanupFns.push(
            window.api.onMenuEvent('menu:execute-query', () => {
                window.dispatchEvent(new CustomEvent('queryflux:execute-query'));
            })
        );

        // Format Query
        cleanupFns.push(
            window.api.onMenuEvent('menu:format-query', () => {
                window.dispatchEvent(new CustomEvent('queryflux:format-query'));
            })
        );

        // Refresh Schema
        cleanupFns.push(
            window.api.onMenuEvent('menu:refresh-schema', () => {
                window.dispatchEvent(new CustomEvent('queryflux:refresh-schema'));
            })
        );

        // Preferences
        cleanupFns.push(
            window.api.onMenuEvent('menu:preferences', () => {
                navigate('/settings');
            })
        );

        return () => {
            cleanupFns.forEach(cleanup => cleanup());
        };
    }, [navigate]);
}
