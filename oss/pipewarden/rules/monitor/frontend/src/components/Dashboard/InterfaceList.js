import React, { useState } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  background: var(--bg-glass);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border: var(--border);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: var(--shadow-primary);
  margin-top: 2rem;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--accent-blue), var(--accent-green), var(--accent-orange));
    border-radius: 20px 20px 0 0;
  }
`;

const Title = styled.h2`
  margin: 0 0 2rem 0;
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 600;
  background: linear-gradient(135deg, var(--text-primary), var(--accent-blue));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const TabContainer = styled.div`
  display: flex;
  margin-bottom: 2rem;
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 0.25rem;
  overflow-x: auto;
  
  &::-webkit-scrollbar {
    height: 4px;
  }
`;

const Tab = styled.button`
  background: ${props => props.active ? 'var(--bg-glass)' : 'transparent'};
  backdrop-filter: ${props => props.active ? 'var(--blur)' : 'none'};
  -webkit-backdrop-filter: ${props => props.active ? 'var(--blur)' : 'none'};
  border: ${props => props.active ? 'var(--border)' : 'none'};
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  color: ${props => props.active ? 'var(--text-primary)' : 'var(--text-secondary)'};
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  position: relative;
  overflow: hidden;
  
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
    color: var(--text-primary);
    transform: translateY(-2px);
    
    &::before {
      left: 100%;
    }
  }
`;

const InterfaceGrid = styled.div`
  display: grid;
  gap: 1rem;
`;

const InterfaceItem = styled.div`
  padding: 1.5rem;
  background: var(--bg-secondary);
  border: var(--border);
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: ${props => props.hasError ? 'var(--accent-red)' : 'var(--accent-green)'};
    border-radius: 0 2px 2px 0;
  }
  
  &:hover {
    background: var(--bg-glass-hover);
    transform: translateX(8px);
    border: var(--border-hover);
  }
`;

const InterfaceHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
`;

const InterfaceName = styled.h4`
  margin: 0;
  color: var(--text-primary);
  font-size: 1.1rem;
  font-weight: 600;
`;

const StatusBadge = styled.div`
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: ${props => props.hasError ? 'rgba(255, 69, 58, 0.2)' : 'rgba(48, 209, 88, 0.2)'};
  color: ${props => props.hasError ? 'var(--accent-red)' : 'var(--accent-green)'};
  border: 1px solid ${props => props.hasError ? 'var(--accent-red)' : 'var(--accent-green)'};
`;

const ErrorMessage = styled.div`
  color: var(--accent-red);
  margin: 1rem 0;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 1rem;
  background: rgba(255, 69, 58, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(255, 69, 58, 0.2);
`;

const InterfaceDetails = styled.div`
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  
  strong {
    color: var(--text-primary);
  }
`;

const ResponseDetails = styled.details`
  margin-top: 1rem;
  
  summary {
    cursor: pointer;
    color: var(--accent-blue);
    font-weight: 600;
    padding: 0.5rem;
    border-radius: 6px;
    transition: background-color 0.2s ease;
    
    &:hover {
      background: rgba(0, 122, 255, 0.1);
    }
  }
  
  pre {
    font-size: 0.75rem;
    overflow: auto;
    background: var(--bg-primary);
    padding: 1rem;
    border-radius: 8px;
    margin-top: 0.5rem;
    border: var(--border);
    color: var(--text-secondary);
    max-height: 300px;
    
    &::-webkit-scrollbar {
      width: 6px;
    }
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 2rem;
  color: var(--text-secondary);
  
  &::before {
    content: '✨';
    display: block;
    font-size: 3rem;
    margin-bottom: 1rem;
  }
`;

const InterfaceList = ({ interfaces }) => {
  const [activeTab, setActiveTab] = useState('api');

  const tabs = [
    { key: 'api', label: 'API Services', icon: '🌐' },
    { key: 'database', label: 'Database', icon: '🗄️' },
    { key: 'timeBased', label: 'Time-Based', icon: '⏰' },
    { key: 'json', label: 'JSON', icon: '📋' }
  ];

  const renderInterfaces = (interfaceList) => {
    if (!interfaceList || interfaceList.length === 0) {
      return (
        <EmptyState>
          All systems operational. No errors detected.
        </EmptyState>
      );
    }

    return interfaceList.map((item, index) => (
      <InterfaceItem key={index} hasError={true}>
        <InterfaceHeader>
          <InterfaceName>
            {item.envName ? `${item.envName} - ${item.projName}` : item.dbName}
          </InterfaceName>
          <StatusBadge hasError={true}>Error</StatusBadge>
        </InterfaceHeader>
        
        {item.requestName && (
          <InterfaceDetails>
            <strong>Request:</strong> {item.requestName}
          </InterfaceDetails>
        )}
        
        <ErrorMessage>{item.message}</ErrorMessage>
        
        {item.responseXML && (
          <ResponseDetails>
            <summary>📋 View Response Details</summary>
            <pre>{item.responseXML}</pre>
          </ResponseDetails>
        )}
      </InterfaceItem>
    ));
  };

  return (
    <Container>
      <Title>Interface Diagnostics</Title>
      
      <TabContainer>
        {tabs.map(tab => (
          <Tab
            key={tab.key}
            active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {tab.label}
          </Tab>
        ))}
      </TabContainer>

      <InterfaceGrid>
        {renderInterfaces(interfaces[activeTab])}
      </InterfaceGrid>
    </Container>
  );
};

export default InterfaceList;