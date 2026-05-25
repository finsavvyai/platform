import React from 'react';
import styled from 'styled-components';
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { SignInButton } from './TCAD/SignInButton';
import { SignOutButton } from './TCAD/SignOutButton';

const Header = styled.header`
  background: var(--bg-glass);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border: none;
  border-bottom: var(--border);
  color: var(--text-primary);
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 1000;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, transparent, rgba(0, 122, 255, 0.1), transparent);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  &:hover::before {
    opacity: 1;
  }
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateY(-2px);
  }
`;

const LogoIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-green));
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  color: white;
  box-shadow: var(--shadow-secondary);
`;

const LogoText = styled.h1`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  background: linear-gradient(135deg, var(--text-primary), var(--text-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
`;

const UserName = styled.span`
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
  opacity: 0;
  animation: fadeInSlide 0.6s ease forwards 0.3s;
  
  @keyframes fadeInSlide {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;

const StatusDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-green);
  box-shadow: 0 0 8px var(--accent-green);
  animation: pulse 2s infinite;
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
`;

const TopBar = () => {
  const isAuthenticated = useIsAuthenticated();
  const { accounts } = useMsal();

  const username = isAuthenticated && accounts.length > 0 
    ? accounts[0].name || accounts[0].username 
    : '';

  return (
    <Header>
      <Logo>
        <LogoIcon>M</LogoIcon>
        <LogoText>BSL Monitor Dashboard</LogoText>
      </Logo>
      <UserInfo>
        {isAuthenticated ? (
          <>
            <StatusDot />
            <UserName>Welcome, {username}</UserName>
            <SignOutButton />
          </>
        ) : (
          <SignInButton />
        )}
      </UserInfo>
    </Header>
  );
};

export default TopBar;