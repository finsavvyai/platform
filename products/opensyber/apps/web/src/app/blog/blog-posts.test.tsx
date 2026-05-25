/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

import IntroducingPost from './introducing-opensyber/page';
import KillChainPost from './ai-agent-kill-chain/page';
import SlopsquattingPost from './slopsquatting-npm-attacks/page';
import SupplyChainPost from './supply-chain-attacks-targeting-ai-agents/page';
import McpSecurityPost from './mcp-security-best-practices/page';
import EuAiActPost from './eu-ai-act-compliance-for-agent-platforms/page';
import SecureCodingPost from './secure-ai-coding-agents/page';
import SelfHostedPost from './why-self-hosted-ai-agents-are-a-security-risk/page';

const posts = [
  { name: 'IntroducingPost', Component: IntroducingPost, title: /Introducing OpenSyber/i },
  { name: 'KillChainPost', Component: KillChainPost, title: /KILL CHAIN/i },
  { name: 'SlopsquattingPost', Component: SlopsquattingPost, title: /SLOPSQUATTING/i },
  { name: 'SupplyChainPost', Component: SupplyChainPost, title: /SUPPLY CHAIN/i },
  { name: 'McpSecurityPost', Component: McpSecurityPost, title: /MCP SECURITY/i },
  { name: 'EuAiActPost', Component: EuAiActPost, title: /EU AI ACT/i },
  { name: 'SecureCodingPost', Component: SecureCodingPost, title: /SECURE AI CODING/i },
  { name: 'SelfHostedPost', Component: SelfHostedPost, title: /Self-Hosted AI Agents/i },
];

describe('Blog posts', () => {
  posts.forEach(({ name, Component, title }) => {
    it(`${name} renders title and article content`, () => {
      render(<Component />);
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
      const article = document.querySelector('article');
      expect(article).not.toBeNull();
    });
  });

  it('IntroducingPost has article tag', () => {
    render(<IntroducingPost />);
    expect(document.querySelector('article')).not.toBeNull();
  });

  it('blog posts contain author info', () => {
    render(<IntroducingPost />);
    expect(screen.getByText('OpenSyber Team')).toBeDefined();
  });
});
