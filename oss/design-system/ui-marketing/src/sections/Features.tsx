import React from 'react';

export interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface FeaturesProps {
  features: Feature[];
}

export const Features: React.FC<FeaturesProps> = ({ features }) => {
  const containerStyle: React.CSSProperties = {
    padding: '60px 40px',
    backgroundColor: '#FFFFFF',
    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '32px',
    maxWidth: '1200px',
    margin: '0 auto',
  };

  const cardStyle: React.CSSProperties = {
    padding: '24px',
    textAlign: 'center',
  };

  const iconStyle: React.CSSProperties = {
    fontSize: '48px',
    marginBottom: '16px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#000000',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#8E8E93',
    lineHeight: '1.6',
  };

  return (
    <section style={containerStyle} data-testid="features">
      <div style={gridStyle} data-testid="features-grid">
        {features.map((feature, idx) => (
          <div
            key={idx}
            style={cardStyle}
            data-testid={`feature-${idx}`}
          >
            <div style={iconStyle}>{feature.icon}</div>
            <h3 style={titleStyle}>{feature.title}</h3>
            <p style={descriptionStyle}>{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

Features.displayName = 'Features';
