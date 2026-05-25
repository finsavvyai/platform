/**
 * Branded Header Component
 * Displays tenant-branded header with logo, company name, and navigation
 */

import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge,
  Tooltip,
  Switch,
  alpha,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications,
  Settings,
  DarkMode,
  LightMode,
  AccountCircle,
  LogoDev,
  Business,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useBranding, useCompanyInfo, useUIFeatures, useTheme } from './ThemeProvider';
import { BrandAssetResponse } from '../../../../backend/app/api/v1/endpoints/branding';

interface BrandedHeaderProps {
  onMenuToggle?: () => void;
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  notifications?: number;
  drawerWidth?: number;
  hideNavigation?: boolean;
}

const BrandedHeader: React.FC<BrandedHeaderProps> = ({
  onMenuToggle,
  user,
  notifications = 0,
  drawerWidth = 280,
  hideNavigation = false,
}) => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [profileAnchorEl, setProfileAnchorEl] = useState<null | HTMLElement>(null);
  const [brandAssets, setBrandAssets] = useState<BrandAssetResponse[]>([]);

  const { branding } = useBranding();
  const companyInfo = useCompanyInfo();
  const uiFeatures = useUIFeatures();
  const { isDarkMode, toggleTheme, themeType, enableSwitcher } = useTheme();

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileAnchorEl(null);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    handleProfileMenuClose();
  };

  // Fetch brand assets
  React.useEffect(() => {
    const fetchBrandAssets = async () => {
      try {
        const response = await fetch('/api/v1/branding/assets?asset_type=logo');
        if (response.ok) {
          const assets = await response.json();
          setBrandAssets(assets);
        }
      } catch (error) {
        console.error('Failed to fetch brand assets:', error);
      }
    };

    if (branding) {
      fetchBrandAssets();
    }
  }, [branding]);

  // Get primary logo
  const primaryLogo = brandAssets.find(asset => asset.asset_type === 'logo' && asset.is_primary);
  const logoUrl = primaryLogo?.file_url || '/logo.svg';

  // Custom styles based on branding
  const headerStyle = {
    backgroundColor: branding?.theme.colors.background || 'transparent',
    color: branding?.theme.colors.text || 'inherit',
    borderBottom: `1px solid ${branding?.theme.colors.border || '#E5E7EB'}`,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    height: `${branding?.theme.layout.header.height || 64}px`,
  };

  const logoStyle = {
    height: 32,
    width: 32,
    marginRight: 2,
    filter: branding?.theme.colors.text ? 'brightness(0) invert(1)' : 'none',
  };

  return (
    <AppBar position="fixed" sx={headerStyle}>
      <Toolbar>
        {!hideNavigation && onMenuToggle && (
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={onMenuToggle}
            edge="start"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Logo and Company Name */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexGrow: 1,
            cursor: 'pointer',
          }}
          onClick={() => navigate('/')}
        >
          {uiFeatures.showLogo && (
            <img
              src={logoUrl}
              alt={`${companyInfo.companyName} logo`}
              style={logoStyle}
              onError={(e) => {
                // Fallback to default logo if custom logo fails
                e.currentTarget.src = '/logo-default.svg';
              }}
            />
          )}

          <Box sx={{ ml: 2 }}>
            <Typography
              variant="h6"
              component="div"
              sx={{
                fontWeight: 600,
                color: 'inherit',
                textDecoration: 'none',
                fontSize: {
                  xs: '1rem',
                  sm: '1.1rem',
                  md: '1.2rem',
                },
              }}
            >
              {companyInfo.companyName}
            </Typography>
            {uiFeatures.showTagline && companyInfo.tagline && (
              <Typography
                variant="body2"
                sx={{
                  color: 'inherit',
                  opacity: 0.8,
                  fontSize: {
                    xs: '0.75rem',
                    sm: '0.8rem',
                    md: '0.9rem',
                  },
                  display: {
                    xs: 'none',
                    sm: 'block',
                  },
                }}
              >
                {companyInfo.tagline}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Right Side Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Theme Switcher */}
          {enableSwitcher && (
            <Tooltip title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
              <IconButton
                color="inherit"
                onClick={toggleTheme}
                size="small"
              >
                {isDarkMode ? <LightMode /> : <DarkMode />}
              </IconButton>
            </Tooltip>
          )}

          {/* Notifications */}
          <Tooltip title="Notifications">
            <IconButton color="inherit" onClick={() => navigate('/notifications')}>
              <Badge badgeContent={notifications} color="error">
                <Notifications />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Settings */}
          <Tooltip title="Settings">
            <IconButton color="inherit" onClick={() => navigate('/settings')}>
              <Settings />
            </IconButton>
          </Tooltip>

          {/* User Profile */}
          {user && (
            <Tooltip title={user.name || 'User Profile'}>
              <IconButton
                color="inherit"
                onClick={handleProfileMenuOpen}
                size="small"
              >
                {user.avatar ? (
                  <Avatar
                    src={user.avatar}
                    alt={user.name}
                    sx={{ width: 32, height: 32 }}
                  />
                ) : (
                  <AccountCircle />
                )}
              </IconButton>
            </Tooltip>
          )}

          {/* User Menu */}
          <Menu
            anchorEl={profileAnchorEl}
            open={Boolean(profileAnchorEl)}
            onClose={handleProfileMenuClose}
            onClick={handleProfileMenuClose}
            PaperProps={{
              elevation: 3,
              sx: {
                minWidth: 200,
                mt: 1,
              },
            }}
          >
            <MenuItem onClick={() => handleNavigate('/profile')}>
              <AccountCircle sx={{ mr: 2 }} />
              Profile
            </MenuItem>
            <MenuItem onClick={() => handleNavigate('/account')}>
              <Business sx={{ mr: 2 }} />
              Account Settings
            </MenuItem>
            <MenuItem onClick={() => handleNavigate('/branding')}>
              <LogoDev sx={{ mr: 2 }} />
              Branding
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => handleNavigate('/help')}>
              Help & Support
            </MenuItem>
            <MenuItem onClick={() => {
              // Handle logout
              handleNavigate('/logout');
            }}>
              Logout
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default BrandedHeader;