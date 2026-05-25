/**
 * AutoBoot Framework Landing Page
 * Professional enterprise-grade design.
 *
 * Assembled from split template sections for maintainability.
 */

import { landingBaseStyles } from './base-styles';
import { landingHeroStyles } from './hero-styles';
import { landingSectionStyles } from './section-styles';
import { landingCoreModuleStyles } from './core-module-styles';
import { landingFooterStyles } from './footer-styles';
import { landingNavHeroHTML } from './nav-hero-html';
import { landingFeaturesHTML } from './features-html';
import { landingArchitectureHTML } from './architecture-html';
import { landingFooterHTML } from './footer-html';

export const landingPageHTML =
  landingBaseStyles +
  landingHeroStyles +
  landingSectionStyles +
  landingCoreModuleStyles +
  landingFooterStyles +
  landingNavHeroHTML +
  landingFeaturesHTML +
  landingArchitectureHTML +
  landingFooterHTML;
