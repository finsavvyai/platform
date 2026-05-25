import React from 'react';

export interface FooterLink {
  label: string;
  href: string;
}

interface FooterProps {
  links: FooterLink[];
  copyright: string;
}

export const Footer: React.FC<FooterProps> = ({ links, copyright }) => {
  const containerStyle: React.CSSProperties = {
    padding: '40px',
    backgroundColor: '#1C1C1E',
    color: '#FFFFFF',
    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
  };

  const contentStyle: React.CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '40px',
    flexWrap: 'wrap',
  };

  const linksStyle: React.CSSProperties = {
    display: 'flex',
    gap: '24px',
    listStyle: 'none',
    padding: 0,
    margin: 0,
  };

  const linkStyle: React.CSSProperties = {
    color: '#FFFFFF',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'opacity 0.2s',
  };

  const copyrightStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#8E8E93',
  };

  return (
    <footer style={containerStyle} data-testid="footer">
      <div style={contentStyle}>
        <nav>
          <ul style={linksStyle} data-testid="footer-links">
            {links.map((link, idx) => (
              <li key={idx}>
                <a
                  href={link.href}
                  style={linkStyle}
                  data-testid={`link-${idx}`}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <p style={copyrightStyle} data-testid="copyright">
          {copyright}
        </p>
      </div>
    </footer>
  );
};

Footer.displayName = 'Footer';
