import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SkillUsageCounter from './SkillUsageCounter';

describe('SkillUsageCounter', () => {
  it('renders the formatted count with a uses label', () => {
    render(<SkillUsageCounter count={87} />);
    expect(screen.getByTestId('skill-usage-counter')).toHaveTextContent('87');
    expect(screen.getByTestId('skill-usage-counter')).toHaveTextContent('uses');
  });

  it('uses short-form formatting for 1k+', () => {
    render(<SkillUsageCounter count={2500} />);
    expect(screen.getByTestId('skill-usage-counter')).toHaveTextContent('2.5k');
  });

  it('accepts an override label', () => {
    render(<SkillUsageCounter count={5} label="installs" />);
    expect(screen.getByTestId('skill-usage-counter')).toHaveTextContent('installs');
  });

  it('mutes styling for counts under 100', () => {
    render(<SkillUsageCounter count={42} />);
    expect(screen.getByTestId('skill-usage-counter').className).toMatch(/zinc-500/);
  });

  it('accents styling when count >= 1000', () => {
    render(<SkillUsageCounter count={5000} />);
    expect(screen.getByTestId('skill-usage-counter').className).toMatch(/emerald/);
  });
});
