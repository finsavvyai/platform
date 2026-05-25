/**
 * Dashboard Page - Stats, card, table, and badge styles
 */

export const dashboardComponentStyles = `
        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
            margin-bottom: 32px;
        }

        .stat-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
            transition: all 0.3s;
        }

        .stat-card:hover {
            background: var(--bg-card-hover);
            border-color: var(--accent);
        }

        .stat-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
        }

        .stat-icon {
            width: 48px;
            height: 48px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }

        .stat-icon.blue { background: rgba(67, 97, 238, 0.15); }
        .stat-icon.green { background: rgba(16, 185, 129, 0.15); }
        .stat-icon.yellow { background: rgba(245, 158, 11, 0.15); }
        .stat-icon.purple { background: rgba(139, 92, 246, 0.15); }

        .stat-value {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 4px;
        }

        .stat-label {
            color: var(--text-secondary);
            font-size: 14px;
        }

        .stat-change {
            font-size: 13px;
            font-weight: 600;
            margin-top: 8px;
        }

        .stat-change.positive { color: var(--success); }
        .stat-change.negative { color: var(--error); }

        /* Card */
        .card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .card-title {
            font-size: 20px;
            font-weight: 600;
        }

        /* Table */
        .table {
            width: 100%;
            border-collapse: collapse;
        }

        .table th {
            text-align: left;
            padding: 12px;
            border-bottom: 1px solid var(--border);
            color: var(--text-secondary);
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .table td {
            padding: 16px 12px;
            border-bottom: 1px solid var(--border);
        }

        .table tr:last-child td {
            border-bottom: none;
        }

        .table tr:hover {
            background: rgba(255, 255, 255, 0.02);
        }

        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }

        .badge.active {
            background: rgba(16, 185, 129, 0.15);
            color: var(--success);
        }

        .badge.inactive {
            background: rgba(239, 68, 68, 0.15);
            color: var(--error);
        }

        .badge.pending {
            background: rgba(245, 158, 11, 0.15);
            color: var(--warning);
        }
`;
