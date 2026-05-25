/**
 * User Dashboard Page
 * Account management, usage statistics, billing, and API keys
 *
 * Assembled from split template sections for maintainability.
 */

import { dashboardHeadHTML } from './head-html';
import { dashboardLayoutStyles } from './layout-styles';
import { dashboardComponentStyles } from './component-styles';
import { dashboardModalStyles } from './modal-styles';
import { dashboardFormStyles } from './form-styles';
import { dashboardSidebarHTML } from './sidebar-html';
import { dashboardTabsOverviewHTML } from './tabs-overview-html';
import { dashboardTabsDataHTML } from './tabs-data-html';
import { dashboardSettingsHTML } from './settings-html';
import { dashboardScriptsInit } from './scripts-init';
import { dashboardScriptsActions } from './scripts-actions';

export const dashboardPageHTML =
  dashboardHeadHTML +
  dashboardLayoutStyles +
  dashboardComponentStyles +
  dashboardModalStyles +
  dashboardFormStyles +
  dashboardSidebarHTML +
  dashboardTabsOverviewHTML +
  dashboardTabsDataHTML +
  dashboardSettingsHTML +
  dashboardScriptsInit +
  dashboardScriptsActions;
