// AutoBoot Integration Hub - Modal and visual flow CSS styles

export const stylesModal = `
        /* Modal */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(8px);
            z-index: 1000;
            overflow-y: auto;
        }

        .modal.active {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
        }

        .modal-content {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 1rem;
            max-width: 1200px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            position: relative;
        }

        .modal-header {
            padding: 2rem;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .close-btn {
            width: 40px;
            height: 40px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 1.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .close-btn:hover {
            background: var(--bg-primary);
            color: var(--text-primary);
        }

        .modal-body {
            padding: 2rem;
        }

        /* Visual Flow */
        .visual-flow {
            margin-bottom: 3rem;
        }

        .flow-title {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 2rem;
            text-align: center;
        }

        .flow-steps {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 1rem;
            margin-bottom: 2rem;
        }

        .flow-step {
            flex: 1;
            text-align: center;
        }

        .step-circle {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, var(--accent) 0%, #00d4ff 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            margin: 0 auto 1rem;
            animation: pulse 2s ease-in-out infinite;
        }

        .step-circle.completed {
            background: var(--accent-green);
            animation: none;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(67, 97, 238, 0.4); }
            50% { transform: scale(1.05); box-shadow: 0 0 20px 10px rgba(67, 97, 238, 0); }
        }

        .step-label {
            font-weight: 600;
            margin-bottom: 0.5rem;
        }

        .step-description {
            font-size: 0.875rem;
            color: var(--text-secondary);
        }

        .flow-arrow {
            font-size: 2rem;
            color: var(--accent);
            margin-top: 2rem;
        }`;
