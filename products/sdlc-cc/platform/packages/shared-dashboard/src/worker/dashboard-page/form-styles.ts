/**
 * Dashboard Page - Form, progress bar, and responsive styles
 */

export const dashboardFormStyles = `
        .form-group {
            margin-bottom: 20px;
        }

        .form-label {
            display: block;
            margin-bottom: 8px;
            font-size: 14px;
            font-weight: 600;
        }

        .form-input {
            width: 100%;
            padding: 12px 16px;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 14px;
        }

        .form-input:focus {
            outline: none;
            border-color: var(--accent);
        }

        .form-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-top: 24px;
        }

        /* Progress Bar */
        .progress-bar {
            height: 8px;
            background: var(--bg-secondary);
            border-radius: 4px;
            overflow: hidden;
            margin-top: 8px;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--accent), var(--success));
            transition: width 0.3s;
        }

        @media (max-width: 768px) {
            .sidebar {
                width: 100%;
                position: static;
                border-right: none;
                border-bottom: 1px solid var(--border);
            }

            .main-content {
                margin-left: 0;
            }

            .stats-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
`;
