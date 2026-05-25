import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import StatusCard from './StatusCard';
import InterfaceList from './InterfaceList';
import { useMsal } from "@azure/msal-react";

const DashboardContainer = styled.div`
  padding: 2rem;
  min-height: 100vh;
  position: relative;
  overflow: hidden;
`;

const Header = styled.h1`
  color: var(--text-primary);
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 3rem;
  text-align: center;
  background: linear-gradient(135deg, var(--text-primary), var(--accent-blue));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  opacity: 0;
  animation: fadeInUp 1s ease forwards 0.2s;
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const ControlsBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 1rem 2rem;
  background: var(--bg-glass);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border: var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-secondary);
`;

const StatusGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
  perspective: 1000px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
`;

const RefreshButton = styled.button`
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-green));
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-secondary);
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s ease;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 122, 255, 0.3);
    
    &::before {
      left: 100%;
    }
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const LastUpdate = styled.p`
  color: var(--text-secondary);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &::before {
    content: '●';
    color: var(--accent-green);
    animation: pulse 2s infinite;
  }
`;

const Dashboard = () => {
  const [status, setStatus] = useState(null);
  const [interfaces, setInterfaces] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const { instance, accounts } = useMsal();

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      
      const config = token ? {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      } : {};

      const [statusRes, interfacesRes] = await Promise.all([
        axios.get('/api/dashboard/status', config),
        axios.get('/api/dashboard/interfaces', config)
      ]);

      setStatus(statusRes.data);
      setInterfaces(interfacesRes.data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAccessToken = async () => {
    // For local development, skip token if not authenticated
    if (!accounts || accounts.length === 0) {
      return null;
    }

    const request = {
      scopes: ["User.Read"],
      account: accounts[0]
    };

    try {
      const response = await instance.acquireTokenSilent(request);
      return response.accessToken;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  };

  const executeInterface = async (type) => {
    try {
      const token = await getAccessToken();
      const config = token ? {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      } : {};

      await axios.post(`/api/dashboard/execute/${type}`, {}, config);
      fetchData();
    } catch (error) {
      console.error(`Error executing ${type} interface:`, error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading && !status) {
    return (
      <DashboardContainer>
        <Header>Initializing Monitor Dashboard...</Header>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer>
      <Header>System Interface Monitor</Header>
      
      <ControlsBar className="glassmorphism">
        <RefreshButton onClick={fetchData} disabled={loading}>
          {loading ? '⟳ Syncing...' : '⟳ Refresh Status'}
        </RefreshButton>

        {lastUpdate && (
          <LastUpdate>
            Live • Updated {lastUpdate.toLocaleString()}
          </LastUpdate>
        )}
      </ControlsBar>

      {status && (
        <StatusGrid>
          <StatusCard
            title="API Services"
            subtitle="External Interface Health"
            status={status.api.status}
            errorCount={status.api.errorCount}
            onExecute={() => executeInterface('api')}
            delay={0}
          />
          <StatusCard
            title="Database"
            subtitle="Connection Integrity"
            status={status.database.status}
            errorCount={status.database.errorCount}
            onExecute={() => executeInterface('database')}
            delay={0.1}
          />
          <StatusCard
            title="Time-Based Monitor"
            subtitle="Scheduled Operations"
            status={status.timeBased.status}
            errorCount={status.timeBased.errorCount}
            onExecute={() => executeInterface('timebased')}
            delay={0.2}
          />
          <StatusCard
            title="JSON Monitor"
            subtitle="Data Validation"
            status={status.json.status}
            errorCount={status.json.errorCount}
            onExecute={() => executeInterface('json')}
            delay={0.3}
          />
        </StatusGrid>
      )}

      {interfaces && <InterfaceList interfaces={interfaces} />}
    </DashboardContainer>
  );
};

export default Dashboard;