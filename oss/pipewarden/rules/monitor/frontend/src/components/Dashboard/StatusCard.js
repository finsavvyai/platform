import React from 'react';
import styled from 'styled-components';

const Card = styled.div`
  background: var(--bg-glass);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border: var(--border);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: var(--shadow-primary);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  transform-style: preserve-3d;
  opacity: 0;
  transform: translateY(30px) rotateX(10deg);
  animation: cardSlideIn 0.8s ease forwards ${props => props.delay}s;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: ${props => 
      props.status === 'healthy' 
        ? 'linear-gradient(90deg, var(--accent-green), var(--accent-blue))'
        : 'linear-gradient(90deg, var(--accent-red), var(--accent-orange))'
    };
    border-radius: 20px 20px 0 0;
  }
  
  &::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: ${props => 
      props.status === 'healthy' 
        ? 'radial-gradient(circle, rgba(48, 209, 88, 0.1) 0%, transparent 70%)'
        : 'radial-gradient(circle, rgba(255, 69, 58, 0.1) 0%, transparent 70%)'
    };
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }

  &:hover {
    transform: translateY(-8px) rotateX(5deg) rotateY(2deg);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    border: var(--border-hover);
    
    &::after {
      opacity: 1;
    }
  }
  
  @keyframes cardSlideIn {
    to {
      opacity: 1;
      transform: translateY(0) rotateX(0deg);
    }
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
`;

const TitleSection = styled.div`
  flex: 1;
`;

const Title = styled.h3`
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.2;
`;

const Subtitle = styled.p`
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 400;
`;

const StatusSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
`;

const StatusIndicator = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${props => 
    props.status === 'healthy' ? 'var(--accent-green)' : 'var(--accent-red)'
  };
  box-shadow: ${props => 
    props.status === 'healthy' 
      ? '0 0 16px rgba(48, 209, 88, 0.6)' 
      : '0 0 16px rgba(255, 69, 58, 0.6)'
  };
  animation: ${props => 
    props.status === 'healthy' ? 'healthyPulse' : 'errorPulse'
  } 2s infinite;
  
  @keyframes healthyPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.1); }
  }
  
  @keyframes errorPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    25% { opacity: 0.6; transform: scale(1.2); }
    75% { opacity: 0.8; transform: scale(0.9); }
  }
`;

const StatusText = styled.span`
  font-weight: 600;
  font-size: 0.875rem;
  color: ${props => 
    props.status === 'healthy' ? 'var(--accent-green)' : 'var(--accent-red)'
  };
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const MetricsSection = styled.div`
  margin-bottom: 2rem;
`;

const ErrorCount = styled.div`
  font-size: 2rem;
  font-weight: 700;
  color: ${props => 
    props.errorCount > 0 ? 'var(--accent-red)' : 'var(--accent-green)'
  };
  margin-bottom: 0.5rem;
  font-variant-numeric: tabular-nums;
`;

const ErrorLabel = styled.div`
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
`;

const ExecuteButton = styled.button`
  background: var(--bg-glass);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  color: var(--text-primary);
  border: var(--border);
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  width: 100%;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    transition: left 0.5s ease;
  }

  &:hover {
    background: var(--bg-glass-hover);
    border: var(--border-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-secondary);
    
    &::before {
      left: 100%;
    }
  }

  &:active {
    transform: translateY(0);
  }
`;

const StatusCard = ({ title, subtitle, status, errorCount, onExecute, delay = 0 }) => {
  return (
    <Card status={status} delay={delay} className="floating-animation">
      <CardHeader>
        <TitleSection>
          <Title>{title}</Title>
          <Subtitle>{subtitle}</Subtitle>
        </TitleSection>
        <StatusSection>
          <StatusIndicator status={status} />
          <StatusText status={status}>{status}</StatusText>
        </StatusSection>
      </CardHeader>
      
      <MetricsSection>
        <ErrorCount errorCount={errorCount}>
          {errorCount || 0}
        </ErrorCount>
        <ErrorLabel>
          {errorCount > 0 ? `Error${errorCount > 1 ? 's' : ''} Detected` : 'All Systems Operational'}
        </ErrorLabel>
      </MetricsSection>
      
      <ExecuteButton onClick={onExecute}>
        ⚡ Execute Health Check
      </ExecuteButton>
    </Card>
  );
};

export default StatusCard;