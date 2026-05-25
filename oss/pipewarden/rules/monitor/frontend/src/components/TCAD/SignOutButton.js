import React from "react";
import { useMsal } from "@azure/msal-react";
import styled from "styled-components";

const Button = styled.button`
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--accent-red);
  border: 1px solid var(--accent-red);
  background: rgba(255, 69, 58, 0.1);
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
    background: linear-gradient(90deg, transparent, rgba(255, 69, 58, 0.1), transparent);
    transition: left 0.5s ease;
  }
  
  &:hover {
    background: rgba(255, 69, 58, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(255, 69, 58, 0.3);
    
    &::before {
      left: 100%;
    }
  }
  
  &:active {
    transform: translateY(0);
  }
`;

export const SignOutButton = () => {
    const { instance } = useMsal();

    const handleLogout = () => {
        instance.logoutPopup().catch(e => {
            console.error("Logout failed:", e);
        });
    }

    return (
        <Button onClick={handleLogout}>Sign Out</Button>
    )
};