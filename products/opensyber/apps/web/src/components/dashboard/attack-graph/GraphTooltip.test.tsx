/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GraphTooltip } from './GraphTooltip';

const baseNode = {
  id: 'node_abc123def456',
  x: 200,
  y: 150,
  name: 'Production DB',
  assetType: 'database',
  sensitivity: 'high',
  isCrownJewel: false,
  hops: 3,
};

const viewBox = { x: 0, y: 0, w: 800, h: 600 };

describe('GraphTooltip', () => {
  it('renders node name', () => {
    render(
      <GraphTooltip
        node={baseNode}
        viewBox={viewBox}
        svgWidth={800}
        svgHeight={600}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('Production DB')).toBeDefined();
  });

  it('shows asset type label', () => {
    render(
      <GraphTooltip
        node={baseNode}
        viewBox={viewBox}
        svgWidth={800}
        svgHeight={600}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('Database')).toBeDefined();
  });

  it('shows sensitivity and hops', () => {
    render(
      <GraphTooltip
        node={baseNode}
        viewBox={viewBox}
        svgWidth={800}
        svgHeight={600}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('high')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('shows truncated ID', () => {
    render(
      <GraphTooltip
        node={baseNode}
        viewBox={viewBox}
        svgWidth={800}
        svgHeight={600}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('node_abc123d...')).toBeDefined();
  });

  it('shows Crown Jewel label when isCrownJewel is true', () => {
    render(
      <GraphTooltip
        node={{ ...baseNode, isCrownJewel: true }}
        viewBox={viewBox}
        svgWidth={800}
        svgHeight={600}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('Crown Jewel')).toBeDefined();
  });

  it('hides Crown Jewel label when false', () => {
    render(
      <GraphTooltip
        node={baseNode}
        viewBox={viewBox}
        svgWidth={800}
        svgHeight={600}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.queryByText('Crown Jewel')).toBeNull();
  });

  it('calls onDismiss when close button clicked', () => {
    const onDismiss = vi.fn();
    render(
      <GraphTooltip
        node={baseNode}
        viewBox={viewBox}
        svgWidth={800}
        svgHeight={600}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByLabelText('Close tooltip'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
