import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  Skeleton,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Check as CheckIcon,
  Receipt as InvoiceIcon,
  Download as DownloadIcon,
  OpenInNew as OpenIcon,
  Star as StarIcon,
  Bolt as BoltIcon,
} from '@mui/icons-material';
import {
  useSubscription,
  useUsageSummary,
  useInvoices,
  useCreateCheckoutSession,
  useCancelSubscription,
  PRICING_TIERS,
  PricingTier,
  SubscriptionTier,
  BillingPeriod,
  formatPrice,
  getUsagePercentage,
} from '../../services/billingApi';

// Usage Progress Component
interface UsageBarProps {
  label: string;
  used: number;
  limit: number;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
}

const UsageBar: React.FC<UsageBarProps> = ({ label, used, limit, color = 'primary' }) => {
  const percentage = getUsagePercentage(used, limit);
  const isUnlimited = limit === -1;
  const isWarning = percentage >= 80;
  const isError = percentage >= 95;

  const actualColor = isError ? 'error' : isWarning ? 'warning' : color;

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" fontWeight={500}>{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {isUnlimited ? (
            <>{used.toLocaleString()} / <strong>Unlimited</strong></>
          ) : (
            <>{used.toLocaleString()} / {limit.toLocaleString()}</>
          )}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={isUnlimited ? 0 : percentage}
        color={actualColor}
        sx={{
          height: 10,
          borderRadius: 5,
          bgcolor: 'grey.200',
        }}
      />
      {!isUnlimited && percentage >= 80 && (
        <Typography variant="caption" color={actualColor} sx={{ mt: 0.5, display: 'block' }}>
          {percentage >= 95 ? 'Limit reached!' : 'Approaching limit'}
        </Typography>
      )}
    </Box>
  );
};

// Pricing Card Component
interface PricingCardProps {
  tier: PricingTier;
  isCurrentPlan: boolean;
  billingPeriod: BillingPeriod;
  onSelect: (tier: SubscriptionTier) => void;
  loading?: boolean;
}

const PricingCard: React.FC<PricingCardProps> = ({
  tier,
  isCurrentPlan,
  billingPeriod,
  onSelect,
  loading,
}) => {
  const price = billingPeriod === 'monthly' ? tier.monthly_price : tier.yearly_price;
  const monthlyEquivalent = billingPeriod === 'yearly' ? Math.round(tier.yearly_price / 12) : tier.monthly_price;
  const savings = billingPeriod === 'yearly' ? Math.round((1 - tier.yearly_price / (tier.monthly_price * 12)) * 100) : 0;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        border: tier.highlighted ? 2 : 1,
        borderColor: tier.highlighted ? 'primary.main' : 'divider',
        transform: tier.highlighted ? 'scale(1.02)' : 'none',
      }}
    >
      {tier.highlighted && (
        <Chip
          label="Most Popular"
          color="primary"
          size="small"
          icon={<StarIcon />}
          sx={{
            position: 'absolute',
            top: -12,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        />
      )}
      <CardContent sx={{ flexGrow: 1, pt: tier.highlighted ? 4 : 3 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          {tier.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
          {tier.description}
        </Typography>

        <Box sx={{ mb: 3 }}>
          {price === 0 ? (
            <Typography variant="h3" fontWeight={700}>Free</Typography>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                <Typography variant="h3" fontWeight={700}>
                  ${monthlyEquivalent}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ ml: 1 }}>
                  /month
                </Typography>
              </Box>
              {billingPeriod === 'yearly' && savings > 0 && (
                <Chip
                  label={`Save ${savings}%`}
                  size="small"
                  color="success"
                  sx={{ mt: 1 }}
                />
              )}
            </>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        <List dense disablePadding>
          {tier.features.map((feature, index) => (
            <ListItem key={index} disableGutters sx={{ py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <CheckIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={feature} primaryTypographyProps={{ variant: 'body2' }} />
            </ListItem>
          ))}
        </List>
      </CardContent>

      <Box sx={{ p: 2, pt: 0 }}>
        {isCurrentPlan ? (
          <Button fullWidth variant="outlined" disabled>
            Current Plan
          </Button>
        ) : (
          <Button
            fullWidth
            variant={tier.highlighted ? 'contained' : 'outlined'}
            onClick={() => onSelect(tier.tier)}
            disabled={loading}
            startIcon={tier.tier === 'enterprise' ? <BoltIcon /> : undefined}
          >
            {tier.tier === 'enterprise' ? 'Contact Sales' : price === 0 ? 'Get Started' : 'Upgrade'}
          </Button>
        )}
      </Box>
    </Card>
  );
};

const Billing: React.FC = () => {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const { data: subscription } = useSubscription();
  const { data: usage, isLoading: usageLoading } = useUsageSummary();
  const { data: invoices, isLoading: invoicesLoading } = useInvoices();
  const checkoutMutation = useCreateCheckoutSession();
  const cancelMutation = useCancelSubscription();

  const handlePlanSelect = async (tier: SubscriptionTier) => {
    if (tier === 'enterprise') {
      // Redirect to sales contact
      window.open('mailto:sales@upm.plus?subject=Enterprise%20Inquiry', '_blank');
      return;
    }

    try {
      const result = await checkoutMutation.mutateAsync({ tier, billingPeriod });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      await cancelMutation.mutateAsync();
      setCancelDialogOpen(false);
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    }
  };

  const currentTier = PRICING_TIERS.find(t => t.tier === subscription?.tier) || PRICING_TIERS[0];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Billing & Subscription
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your subscription and view usage details
        </Typography>
      </Box>

      {/* Current Plan Card */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="h6">Current Plan</Typography>
                <Chip
                  label={currentTier.name}
                  color="primary"
                  sx={{ fontWeight: 600 }}
                />
                {subscription?.status === 'trial' && (
                  <Chip label="Trial" color="warning" size="small" />
                )}
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {currentTier.description}
              </Typography>

              {subscription && (
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Typography variant="body2">
                    <strong>Billing Period:</strong>{' '}
                    {subscription.billing_period === 'monthly' ? 'Monthly' : 'Yearly'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Next Billing:</strong>{' '}
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </Typography>
                </Box>
              )}

              {subscription?.cancel_at_period_end && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Your subscription will be cancelled at the end of the billing period.
                </Alert>
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                {subscription && subscription.tier !== 'free' && !subscription.cancel_at_period_end && (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => setCancelDialogOpen(true)}
                  >
                    Cancel Subscription
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Usage Section */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        Current Usage
      </Typography>
      <Card sx={{ mb: 4 }}>
        <CardContent>
          {usageLoading ? (
            <Skeleton variant="rectangular" height={200} />
          ) : usage ? (
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <UsageBar
                  label="API Requests"
                  used={usage.api_requests.used}
                  limit={usage.api_requests.limit}
                />
                <UsageBar
                  label="Workflow Executions"
                  used={usage.workflow_executions.used}
                  limit={usage.workflow_executions.limit}
                />
                <UsageBar
                  label="Browser Sessions"
                  used={usage.browser_sessions.used}
                  limit={usage.browser_sessions.limit}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <UsageBar
                  label="Agent Executions"
                  used={usage.agent_executions.used}
                  limit={usage.agent_executions.limit}
                />
                <UsageBar
                  label="Document Processing"
                  used={usage.document_processing.used}
                  limit={usage.document_processing.limit}
                />
                <UsageBar
                  label="Storage (GB)"
                  used={usage.storage_gb.used}
                  limit={usage.storage_gb.limit}
                />
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">Usage data not available</Alert>
          )}
        </CardContent>
      </Card>

      {/* Pricing Plans */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" fontWeight={600}>
          Available Plans
        </Typography>
        <ToggleButtonGroup
          value={billingPeriod}
          exclusive
          onChange={(_, value) => value && setBillingPeriod(value)}
          size="small"
        >
          <ToggleButton value="monthly">Monthly</ToggleButton>
          <ToggleButton value="yearly">
            Yearly
            <Chip label="Save 17%" size="small" color="success" sx={{ ml: 1 }} />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {PRICING_TIERS.map((tier) => (
          <Grid item xs={12} sm={6} md={3} key={tier.tier}>
            <PricingCard
              tier={tier}
              isCurrentPlan={subscription?.tier === tier.tier}
              billingPeriod={billingPeriod}
              onSelect={handlePlanSelect}
              loading={checkoutMutation.isLoading}
            />
          </Grid>
        ))}
      </Grid>

      {/* Invoice History */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        Invoice History
      </Typography>
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoicesLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Skeleton variant="rectangular" height={100} />
                  </TableCell>
                </TableRow>
              ) : invoices && invoices.length > 0 ? (
                invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(invoice.period_start).toLocaleDateString()} -{' '}
                      {new Date(invoice.period_end).toLocaleDateString()}
                    </TableCell>
                    <TableCell align="right">
                      {formatPrice(invoice.amount / 100, invoice.currency)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={invoice.status}
                        size="small"
                        color={invoice.status === 'paid' ? 'success' : 'default'}
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {invoice.invoice_url && (
                        <Tooltip title="View Invoice">
                          <IconButton
                            size="small"
                            onClick={() => window.open(invoice.invoice_url, '_blank')}
                          >
                            <OpenIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {invoice.invoice_pdf && (
                        <Tooltip title="Download PDF">
                          <IconButton
                            size="small"
                            onClick={() => window.open(invoice.invoice_pdf, '_blank')}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <InvoiceIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                    <Typography color="text.secondary">No invoices yet</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Cancel Subscription Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>Cancel Subscription</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to cancel your subscription? You'll continue to have access
            until the end of your current billing period.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Keep Subscription</Button>
          <Button
            onClick={handleCancelSubscription}
            color="error"
            variant="contained"
            disabled={cancelMutation.isLoading}
          >
            {cancelMutation.isLoading ? 'Cancelling...' : 'Cancel Subscription'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Billing;

