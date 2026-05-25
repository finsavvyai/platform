/**
 * Dashboard Page - HTML head and meta tags
 */

export const dashboardHeadHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - AutoBoot Framework</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --bg-primary: #0a0b14;
            --bg-secondary: #141520;
            --bg-card: #1c1d2e;
            --bg-card-hover: #24253a;
            --text-primary: #ffffff;
            --text-secondary: #a0a0b8;
            --accent: #4361ee;
            --accent-hover: #3451d1;
            --success: #10b981;
            --warning: #f59e0b;
            --error: #ef4444;
            --border: rgba(255, 255, 255, 0.1);
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
        }
`;
