/**
 * Dashboard Page - API key, empty state, and modal styles
 */

export const dashboardModalStyles = `
        /* API Key */
        .api-key-row {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
        }

        .api-key-input {
            flex: 1;
            padding: 12px 16px;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text-primary);
            font-family: 'Monaco', monospace;
            font-size: 14px;
        }

        .copy-btn {
            padding: 12px 16px;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.2s;
        }

        .copy-btn:hover {
            border-color: var(--accent);
            color: var(--accent);
        }

        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 60px 20px;
        }

        .empty-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }

        .empty-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .empty-text {
            color: var(--text-secondary);
            margin-bottom: 24px;
        }

        /* Modal */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(8px);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }

        .modal.active {
            display: flex;
        }

        .modal-content {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 32px;
            max-width: 500px;
            width: 90%;
        }

        .modal-header {
            margin-bottom: 24px;
        }

        .modal-title {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 8px;
        }
`;
