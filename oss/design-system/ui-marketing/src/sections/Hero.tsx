import React from 'react';

interface HeroProps {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaHref: string;
  backgroundGradient?: string;
}

export const Hero: React.FC<HeroProps> = ({
  headline,
  subheadline,
  ctaText,
  ctaHref,
  backgroundGradient = 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
}) => {
  const containerStyle: React.CSSProperties = {
    padding: '80px 40px',
    background: backgroundGradient,
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
    minHeight: '400px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  };

  const headlineStyle: React.CSSProperties = {
    fontSize: 'clamp(32px, 5vw, 56px)',
    fontWeight: 700,
    marginBottom: '16px',
    margin: 0,
  };

  const subheadlineStyle: React.CSSProperties = {
    fontSize: 'clamp(16px, 2vw, 24px)',
    fontWeight: 400,
    marginBottom: '32px',
    maxWidth: '600px',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '12px 32px',
    backgroundColor: '#FFFFFF',
    color: '#007AFF',
    fontSize: '16px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
    transition: 'transform 0.2s',
  };

  return (
    <section style={containerStyle} data-testid="hero">
      <h1 style={headlineStyle} data-testid="headline">
        {headline}
      </h1>
      <p style={subheadlineStyle} data-testid="subheadline">
        {subheadline}
      </p>
      <a
        href={ctaHref}
        style={buttonStyle}
        data-testid="cta-button"
      >
        {ctaText}
      </a>
    </section>
  );
};

Hero.displayName = 'Hero';
