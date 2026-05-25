import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './Layout';

function renderLayout(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="dashboard" element={<div>Dashboard Page</div>} />
          <Route path="connections" element={<div>Connections Page</div>} />
          <Route path="query" element={<div>Query Page</div>} />
          <Route path="settings" element={<div>Settings Page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('Layout', () => {
  it('renders sidebar with nav items', () => {
    renderLayout();

    expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Connections/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Query Editor/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Settings/i })).toBeInTheDocument();
  });

  it('toggle sidebar button collapses and expands the sidebar', async () => {
    const user = userEvent.setup();
    renderLayout();

    // Sidebar starts open at w-64
    const sidebar = screen.getByRole('complementary');
    expect(sidebar.className).toContain('w-64');

    // Find the toggle button (the one with the X icon when sidebar is open)
    // It is the button inside the logo header area
    const toggleButtons = sidebar.querySelectorAll('button');
    const toggleButton = toggleButtons[0];

    await user.click(toggleButton);

    // Sidebar should now be w-16
    expect(sidebar.className).toContain('w-16');

    // Click again to re-expand
    await user.click(toggleButton);
    expect(sidebar.className).toContain('w-64');
  });

  it('dark mode toggle button works', async () => {
    const user = userEvent.setup();
    renderLayout();

    // Find the dark mode toggle (button in the footer area of the sidebar)
    // When darkMode=false (matchMedia mock returns false), it shows "Dark Mode"
    const darkModeButton = screen.getByRole('button', { name: /Dark Mode/i });
    expect(darkModeButton).toBeInTheDocument();

    await user.click(darkModeButton);

    // After toggling to dark mode, it should show "Light Mode"
    expect(screen.getByRole('button', { name: /Light Mode/i })).toBeInTheDocument();
  });

  it('shows QueryFlux brand text', () => {
    renderLayout();
    expect(screen.getByText('QueryFlux')).toBeInTheDocument();
  });
});
