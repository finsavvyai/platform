/**
 * Dashboard Page - Sidebar, main content, header, button styles
 */

export const dashboardLayoutStyles = `
        /* Sidebar */
        .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            width: 260px;
            background: var(--bg-secondary);
            border-right: 1px solid var(--border);
            padding: 24px;
            overflow-y: auto;
        }

        .logo {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 40px;
            background: linear-gradient(135deg, var(--accent), var(--success));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .nav-section {
            margin-bottom: 32px;
        }

        .nav-title {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--text-secondary);
            margin-bottom: 12px;
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            margin-bottom: 4px;
            color: var(--text-secondary);
            text-decoration: none;
            border-radius: 8px;
            transition: all 0.2s;
            cursor: pointer;
        }

        .nav-item:hover {
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-primary);
        }

        .nav-item.active {
            background: rgba(67, 97, 238, 0.15);
            color: var(--accent);
        }

        .nav-icon {
            font-size: 18px;
            width: 20px;
        }

        /* Main Content */
        .main-content {
            margin-left: 260px;
            padding: 32px;
            min-height: 100vh;
        }

        .header {
            margin-bottom: 32px;
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        h1 {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 8px;
        }

        .subtitle {
            color: var(--text-secondary);
            font-size: 16px;
        }

        .user-menu {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .user-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--accent), var(--success));
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 16px;
        }

        .btn {
            padding: 10px 20px;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-block;
        }

        .btn:hover {
            background: var(--accent-hover);
            transform: scale(1.02);
        }

        .btn-secondary {
            background: transparent;
            border: 1px solid var(--border);
        }

        .btn-secondary:hover {
            border-color: var(--accent);
            background: rgba(67, 97, 238, 0.1);
        }

        .btn-danger {
            background: var(--error);
        }

        .btn-danger:hover {
            background: #dc2626;
        }
`;
