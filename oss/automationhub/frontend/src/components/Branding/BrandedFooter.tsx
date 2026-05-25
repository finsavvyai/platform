/**
 * Branded Footer Component
 * Displays tenant-branded footer with company info and links
 */

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Link,
  Grid,
  IconButton,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Facebook,
  Twitter,
  LinkedIn,
  Instagram,
  Language,
  Business,
  Email,
  Phone,
  LocationOn,
  Public,
} from '@mui/icons-material';
import { useBranding, useCompanyInfo, useUIFeatures } from './ThemeProvider';

interface BrandedFooterProps {
  variant?: 'default' | 'minimal' | 'comprehensive';
  position?: 'fixed' | 'static';
  backgroundColor?: string;
  textColor?: string;
}

const BrandedFooter: React.FC<BrandedFooterProps> = ({
  variant = 'default',
  position = 'static',
  backgroundColor,
  textColor,
}) => {
  const theme = useTheme();
  const { branding } = useBranding();
  const companyInfo = useCompanyInfo();
  const uiFeatures = useUIFeatures();

  // Footer styling based on branding
  const footerStyle = {
    backgroundColor: backgroundColor || branding?.theme.colors.surface || theme.palette.background.paper,
    color: textColor || branding?.theme.colors.textSecondary || theme.palette.text.secondary,
    py: variant === 'minimal' ? 2 : 4,
    px: 2,
    borderTop: `1px solid ${branding?.theme.colors.border || theme.palette.divider}`,
    ...(position === 'fixed' && {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      width: '100%',
      zIndex: theme.zIndex.drawer + 1,
    }),
  };

  const copyrightYear = new Date().getFullYear();

  const socialLinks = [
    {
      name: 'Facebook',
      icon: <Facebook />,
      url: 'https://facebook.com/upmplus',
    },
    {
      name: 'Twitter',
      icon: <Twitter />,
      url: 'https://twitter.com/upmplus',
    },
    {
      name: 'LinkedIn',
      icon: <LinkedIn />,
      url: 'https://linkedin.com/company/upmplus',
    },
    {
      name: 'Instagram',
      icon: <Instagram />,
      url: 'https://instagram.com/upmplus',
    },
  ];

  const quickLinks = [
    { name: 'About Us', url: '/about' },
    { name: 'Features', url: '/features' },
    { name: 'Pricing', url: '/pricing' },
    { name: 'Documentation', url: '/docs' },
    { name: 'API', url: '/api' },
    { name: 'Support', url: '/support' },
  ];

  const legalLinks = [
    { name: 'Privacy Policy', url: '/privacy' },
    { name: 'Terms of Service', url: '/terms' },
    { name: 'Cookie Policy', url: '/cookies' },
    { name: 'Compliance', url: '/compliance' },
    { name: 'Security', url: '/security' },
  ];

  if (!uiFeatures.showFooter) {
    return null;
  }

  return (
    <Box component="footer" sx={footerStyle}>
      <Container maxWidth="xl">
        <Grid container spacing={4}>
          {/* Company Information */}
          <Grid item xs={12} md={4}>
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="h6"
                gutterBottom={1}
                sx={{ fontWeight: 600 }}
              >
                {companyInfo.company_name}
              </Typography>
              {companyInfo.description && (
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {companyInfo.description}
                </Typography>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {companyInfo.support_email && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Email sx={{ fontSize: 16 }} />
                  <Link
                    href={`mailto:${companyInfo.support_email}`}
                    color="inherit"
                    underline="hover"
                    sx={{
                      fontSize: '0.875rem',
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    {companyInfo.support_email}
                  </Link>
                </Box>
                )}
                {companyInfo.support_phone && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Phone sx={{ fontSize: 16 }} />
                  <Typography variant="body2">
                    {companyInfo.support_phone}
                  </Typography>
                </Box>
                )}
                {companyInfo.support_url && (
                  <Link
                    href={companyInfo.support_url}
                    color="inherit"
                    underline="hover"
                    sx={{
                      fontSize: '0.875rem',
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    Support Center
                  </Link>
                )}
              </Box>
            </Box>
          </Grid>

          {/* Quick Links */}
          {variant === 'comprehensive' && (
            <Grid item xs={12} md={4}>
              <Typography
                variant="h6"
                gutterBottom={2}
                sx={{ fontWeight: 600 }}
              >
                Quick Links
              </Typography>
              <Grid container spacing={1}>
                {quickLinks.map((link) => (
                  <Grid item xs={6} key={link.name}>
                    <Link
                      href={link.url}
                      color="inherit"
                      underline="hover"
                      sx={{
                        fontSize: '0.875rem',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      {link.name}
                    </Link>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          )}

          {/* Legal Links */}
          <Grid item xs={12} md={4}>
            <Typography
              variant="h6"
              gutterBottom={2}
              sx={{ fontWeight: 600 }}
            >
              Legal
            </Typography>
            <Grid container spacing={1}>
              {legalLinks.map((link) => (
                <Grid item xs={6} key={link.name}>
                  <Link
                    href={link.url}
                    color="inherit"
                    underline="hover"
                    sx={{
                      fontSize: '0.875rem',
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    {link.name}
                  </Link>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Bottom Row */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 2, sm: 0 },
          }}
        >
          {/* Copyright */}
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.875rem',
              textAlign: { xs: 'center', sm: 'left' },
            }}
          >
            {copyrightYear} {companyInfo.company_name}. All rights reserved.
          </Typography>

          {/* Powered by */}
          {!uiFeatures.hideUpmBranding && (
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.875rem',
                textAlign: { xs: 'center', sm: 'right' },
              }}
            >
              Powered by{' '}
              <Link
                href="https://upm.plus"
                target="_blank"
                rel="noopener noreferrer"
                color="inherit"
                underline="hover"
                sx={{
                  fontWeight: 600,
                  ml: 0.5,
                  '&:hover': { color: 'primary.main' },
                }}
              >
                UPM.Plus
              </Link>
              {' '}
              AutomationHub
            </Typography>
          )}

          {/* Social Links */}
          {variant === 'comprehensive' && (
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
              }}
            >
              {socialLinks.map((social) => (
                <IconButton
                  key={social.name}
                  component="a"
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  color="inherit"
                  size="small"
                  sx={{
                    '&:hover': {
                      color: 'primary.main',
                      backgroundColor: alpha(branding?.theme.colors.primary || theme.palette.primary.main, 0.04),
                    },
                  }}
                >
                  {social.icon}
                </IconButton>
              ))}
            </Box>
          )}
        </Box>
      </Container>
    </Box>
  );
};

export default BrandedFooter;