// AutoBoot Integration Hub - Assembles all page sections
// Split from integrations-page.ts for maintainability

import { headOpen } from './head-open';
import { stylesBase } from './styles-base';
import { stylesModal } from './styles-modal';
import { stylesCode } from './styles-code';
import { stylesPreview } from './styles-preview';
import { headerAndCards } from './header-and-cards';
import { authModalFlow } from './auth-modal-flow';
import { authModalCors } from './auth-modal-cors';
import { authModalIssues1 } from './auth-modal-issues-1';
import { authModalIssues2 } from './auth-modal-issues-2';
import { authModalIssues3 } from './auth-modal-issues-3';
import { authModalIssues4 } from './auth-modal-issues-4';
import { authModalIssues5 } from './auth-modal-issues-5';
import { authModalIssues6 } from './auth-modal-issues-6';
import { authModalCode } from './auth-modal-code';
import { emailModal } from './email-modal';
import { smsModal } from './sms-modal';
import { scripts } from './scripts';

export const integrationsPageHTML =
  headOpen +
  stylesBase +
  stylesModal +
  stylesCode +
  stylesPreview +
  headerAndCards +
  authModalFlow +
  authModalCors +
  authModalIssues1 +
  authModalIssues2 +
  authModalIssues3 +
  authModalIssues4 +
  authModalIssues5 +
  authModalIssues6 +
  authModalCode +
  emailModal +
  smsModal +
  scripts;
