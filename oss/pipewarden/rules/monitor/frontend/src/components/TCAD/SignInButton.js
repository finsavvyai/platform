import React from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "./authConfig";
import styled from "styled-components";

const Button = styled.button`
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  border: var(--border);
  background: var(--bg-glass);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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

export const SignInButton = () => {
    const { instance } = useMsal();

    const handleLogin = () => {
        instance.loginPopup(loginRequest).catch(e => {
            console.error("Login failed:", e);
        });
    }

    return (
        <Button onClick={handleLogin}>Sign In</Button>
    )
};