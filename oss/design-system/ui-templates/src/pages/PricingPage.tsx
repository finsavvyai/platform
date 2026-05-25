import React from 'react';

export interface Plan {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  recommended?: boolean;
}

interface PricingPageProps {
  plans: Plan[];
  onSelectPlan: (planId: string) => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({
  plans,
  onSelectPlan,
}) => {
  const containerStyle: React.CSSProperties = {
    padding: '40px 20px',
    backgroundColor: '#F2F2F7',
    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  };

  const cardStyle = (recommended?: boolean): React.CSSProperties => ({
    padding: '32px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    border: recommended ? '2px solid #007AFF' : '1px solid #E5E5EA',
    boxShadow: recommended ? '0 10px 30px rgba(0, 122, 255, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
    position: 'relative',
  });

  const ribbonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '16px',
    right: '16px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
  };

  const priceStyle: React.CSSProperties = {
    fontSize: '32px',
    fontWeight: 700,
    marginBottom: '8px',
    color: '#000000',
  };

  const featuresStyle: React.CSSProperties = {
    listStyle: 'none',
    padding: '16px 0',
    margin: 0,
  };

  const featureItemStyle: React.CSSProperties = {
    padding: '8px 0',
    fontSize: '14px',
    color: '#3C3C43',
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    marginTop: '20px',
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  };

  return (
    <div style={containerStyle}>
      <div style={gridStyle} data-testid="plans-grid">
        {plans.map((plan) => (
          <div
            key={plan.id}
            style={cardStyle(plan.recommended)}
            data-testid={`plan-${plan.id}`}
          >
            {plan.recommended && (
              <div style={ribbonStyle}>Recommended</div>
            )}
            <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>
              {plan.name}
            </h3>
            <p style={{ fontSize: '14px', color: '#8E8E93', marginBottom: '16px' }}>
              {plan.description}
            </p>
            <div style={priceStyle}>
              ${plan.price}
              <span style={{ fontSize: '14px', color: '#8E8E93' }}>/mo</span>
            </div>
            <ul style={featuresStyle}>
              {plan.features.map((feature, idx) => (
                <li key={idx} style={featureItemStyle}>
                  ✓ {feature}
                </li>
              ))}
            </ul>
            <button
              style={buttonStyle}
              onClick={() => onSelectPlan(plan.id)}
              data-testid={`select-${plan.id}`}
            >
              Choose Plan
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

PricingPage.displayName = 'PricingPage';
