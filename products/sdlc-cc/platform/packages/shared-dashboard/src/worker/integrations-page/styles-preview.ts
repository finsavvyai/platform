// AutoBoot Integration Hub - Preview and success message CSS styles

export const stylesPreview = `
        /* Live Preview */
        .live-preview {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 0.75rem;
            padding: 2rem;
        }

        .preview-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
        }

        .preview-status {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.875rem;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            background: var(--accent-green);
            border-radius: 50%;
            box-shadow: 0 0 10px var(--accent-green);
            animation: blink 2s ease-in-out infinite;
        }

        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }

        .preview-content {
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            padding: 1.5rem;
            min-height: 200px;
        }

        .test-btn {
            padding: 0.75rem 1.5rem;
            background: var(--accent-green);
            color: white;
            border: none;
            border-radius: 0.5rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .test-btn:hover {
            background: #059669;
            transform: translateY(-1px);
        }

        /* Success Message */
        .success-message {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 0.75rem;
            padding: 1.5rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 2rem;
        }

        .success-icon {
            font-size: 2rem;
        }

        .success-text h3 {
            font-size: 1.125rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
            color: var(--accent-green);
        }

        .success-text p {
            color: var(--text-secondary);
            font-size: 0.875rem;
        }
    </style>
</head>`;
