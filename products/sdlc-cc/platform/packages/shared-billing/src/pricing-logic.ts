import {
  Subscription,
  SubscriptionTier,
  DEFAULT_TIER_CONFIGS,
} from './types';

export interface TierSuggestion {
  currentTier: SubscriptionTier;
  suggestedTier: SubscriptionTier;
  monthlySavingsIfAnnual: number;
}

interface PricingLogicDeps {
  getUserSubscriptions: (userId: string) => Promise<Subscription[]>;
}

export class PricingLogic {
  private deps: PricingLogicDeps;

  constructor(deps: PricingLogicDeps) {
    this.deps = deps;
  }

  async suggestTierUpgrade(userId: string): Promise<TierSuggestion | null> {
    try {
      const subscriptions = await this.deps.getUserSubscriptions(userId);
      if (subscriptions.length === 0) return null;

      const current = subscriptions[0];
      if (current.tier === 'enterprise') return null;

      const suggestedTier: SubscriptionTier =
        current.tier === 'starter' ? 'professional' : 'enterprise';
      const suggestedPrice = DEFAULT_TIER_CONFIGS[suggestedTier].price;
      const monthlySavingsIfAnnual = Math.round(suggestedPrice * 0.2);

      return {
        currentTier: current.tier,
        suggestedTier,
        monthlySavingsIfAnnual,
      };
    } catch (error) {
      console.error('Failed to suggest tier upgrade:', error);
      return null;
    }
  }
}
