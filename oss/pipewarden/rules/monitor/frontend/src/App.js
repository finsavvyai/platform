import React from 'react';
import { MsalProvider, AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "./components/TCAD/authConfig";
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard/Dashboard';
import styled from 'styled-components';

const msalInstance = new PublicClientApplication(msalConfig);

const AppContainer = styled.div`
  min-height: 100vh;
  position: relative;
`;

const LoginContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 80vh;
  text-align: center;
  position: relative;
  padding: 2rem;
`;

const LoginCard = styled.div`
  background: var(--bg-glass);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border: var(--border);
  border-radius: 24px;
  padding: 3rem;
  box-shadow: var(--shadow-primary);
  max-width: 500px;
  width: 100%;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--accent-blue), var(--accent-green), var(--accent-orange));
    border-radius: 24px 24px 0 0;
  }
`;

const LoginIcon = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-green));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: white;
  margin: 0 auto 2rem;
  box-shadow: var(--shadow-secondary);
  animation: float 3s ease-in-out infinite;
  
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
`;

const LoginMessage = styled.h2`
  color: var(--text-primary);
  margin-bottom: 1.5rem;
  font-size: 1.75rem;
  font-weight: 600;
  background: linear-gradient(135deg, var(--text-primary), var(--accent-blue));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const LoginDescription = styled.p`
  color: var(--text-secondary);
  margin-bottom: 2.5rem;
  font-size: 1rem;
  line-height: 1.6;
  opacity: 0.9;
`;

const FloatingParticles = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: -1;
  
  &::before,
  &::after {
    content: '';
    position: absolute;
    border-radius: 50%;
    animation: float 6s ease-in-out infinite;
  }
  
  &::before {
    width: 200px;
    height: 200px;
    background: radial-gradient(circle, rgba(0, 122, 255, 0.1), transparent);
    top: 20%;
    left: 10%;
    animation-delay: 0s;
  }
  
  &::after {
    width: 150px;
    height: 150px;
    background: radial-gradient(circle, rgba(48, 209, 88, 0.08), transparent);
    bottom: 20%;
    right: 15%;
    animation-delay: -3s;
  }
`;

function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AppContainer>
        <FloatingParticles />
        <TopBar />
        
        <AuthenticatedTemplate>
          <Dashboard />
        </AuthenticatedTemplate>

        <UnauthenticatedTemplate>
          <LoginContainer>
            <LoginCard>
              <LoginIcon>🚀</LoginIcon>
              <LoginMessage>BSL Monitor Dashboard</LoginMessage>
              <LoginDescription>
                Secure access to advanced system monitoring. Please authenticate with your Norlys TCAD credentials to continue.
              </LoginDescription>
            </LoginCard>
          </LoginContainer>
        </UnauthenticatedTemplate>
      </AppContainer>
    </MsalProvider>
  );
}

export default App;