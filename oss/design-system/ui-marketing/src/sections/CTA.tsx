import React from 'react';

interface CTAProps {
  headline: string;
  description: string;
  buttonText: string;
  onButtonClick: () => void;
}

export const CTA: React.FC<CTAProps> = ({
  headline,
  description,
  buttonText,
  onButtonClick,
}) => {
  const containerStyle: React.CSSProperties = {
    padding: '60px 40px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
  };

  const headlineStyle: React.CSSProperties = {
    fontSize: 'clamp(24px, 4vw, 40px)',
    fontWeight: 700,
    marginBottom: '16px',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: '16px',
    marginBottom: '32px',
    maxWidth: '600px',
    margin: '16px auto 32px',
    lineHeight: '1.6',
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
    transition: 'transform 0.2s',
  };

  return (
    <section style={containerStyle} data-testid="cta">
      <h2 style={headlineStyle} data-testid="cta-headline">
        {headline}
      </h2>
      <p style={descriptionStyle} data-testid="cta-description">
        {description}
      </p>
      <button
        style={buttonStyle}
        onClick={onButtonClick}
        data-testid="cta-btn"
      >
        {buttonText}
      </button>
    </section>
  );
};

CTA.displayName = 'CTA';
