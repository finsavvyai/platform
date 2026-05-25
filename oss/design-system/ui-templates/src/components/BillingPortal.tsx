import React from 'react';

export interface Subscription {
  planName: string;
  status: 'active' | 'canceled' | 'suspended';
  nextBillingDate?: string;
  amount: number;
}

export interface Usage {
  current: number;
  limit: number;
  unit: string;
}

interface BillingPortalProps {
  subscription: Subscription;
  usage: Usage;
}

export const BillingPortal: React.FC<BillingPortalProps> = ({
  subscription,
  usage,
}) => {
  const containerStyle: React.CSSProperties = {
    padding: '24px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #E5E5EA',
    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
    maxWidth: '500px',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '24px',
  };

  const headingStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '12px',
    color: '#000000',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    fontSize: '14px',
    borderBottom: '1px solid #F2F2F7',
  };

  const usageBarStyle: React.CSSProperties = {
    height: '8px',
    backgroundColor: '#E5E5EA',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px',
  };

  const usageFillStyle: React.CSSProperties = {
    height: '100%',
    backgroundColor: '#34C759',
    width: `${(usage.current / usage.limit) * 100}%`,
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    marginTop: '16px',
    backgroundColor: '#FF3B30',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  };

  return (
    <div style={containerStyle} data-testid="billing-portal">
      <div style={sectionStyle} data-testid="plan-section">
        <h3 style={headingStyle}>Current Plan</h3>
        <div style={rowStyle}>
          <span>Plan:</span>
          <span data-testid="plan-name">{subscription.planName}</span>
        </div>
        <div style={rowStyle}>
          <span>Status:</span>
          <span data-testid="plan-status">{subscription.status}</span>
        </div>
        <div style={rowStyle}>
          <span>Amount:</span>
          <span data-testid="plan-amount">${subscription.amount}/mo</span>
        </div>
        {subscription.nextBillingDate && (
          <div style={rowStyle}>
            <span>Next Billing:</span>
            <span data-testid="billing-date">{subscription.nextBillingDate}</span>
          </div>
        )}
      </div>

      <div style={sectionStyle} data-testid="usage-section">
        <h3 style={headingStyle}>Usage</h3>
        <div style={usageBarStyle}>
          <div style={usageFillStyle} data-testid="usage-bar" />
        </div>
        <p
          style={{
            fontSize: '12px',
            color: '#8E8E93',
            margin: 0,
          }}
          data-testid="usage-text"
        >
          {usage.current} of {usage.limit} {usage.unit}
        </p>
      </div>

      <button
        style={buttonStyle}
        data-testid="cancel-button"
        onClick={() => {}}
      >
        Cancel Subscription
      </button>
    </div>
  );
};

BillingPortal.displayName = 'BillingPortal';
