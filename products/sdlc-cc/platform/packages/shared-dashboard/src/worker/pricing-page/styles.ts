/**
 * Pricing Page - CSS Styles
 * Re-exports combined styles from split modules
 */

import { baseStyles } from './styles-base';
import { componentStyles } from './styles-components';

export const pricingStyles = baseStyles + componentStyles;
