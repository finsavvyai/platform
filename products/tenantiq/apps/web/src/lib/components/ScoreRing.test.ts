import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ScoreRing from './ScoreRing.svelte';

describe('ScoreRing', () => {
	it('should render the score text', () => {
		render(ScoreRing, { props: { score: 85 } });
		expect(screen.getByText('85')).toBeTruthy();
	});

	it('should render default label "Score"', () => {
		render(ScoreRing, { props: { score: 50 } });
		expect(screen.getByText('Score')).toBeTruthy();
	});

	it('should render custom label', () => {
		render(ScoreRing, { props: { score: 50, label: 'Health' } });
		expect(screen.getByText('Health')).toBeTruthy();
	});

	it('should render SVG with correct size', () => {
		const { container } = render(ScoreRing, {
			props: { score: 70, size: 200 }
		});
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('width')).toBe('200');
		expect(svg?.getAttribute('height')).toBe('200');
	});

	it('should use gradient stroke for score >= 70', () => {
		const { container } = render(ScoreRing, { props: { score: 85 } });
		const circles = container.querySelectorAll('circle');
		const scoreCircle = circles[1];
		expect(scoreCircle?.getAttribute('stroke')).toMatch(/url\(#score-gradient/);
	});

	it('should use gradient stroke for score 40-69', () => {
		const { container } = render(ScoreRing, { props: { score: 55 } });
		const circles = container.querySelectorAll('circle');
		const scoreCircle = circles[1];
		expect(scoreCircle?.getAttribute('stroke')).toMatch(/url\(#score-gradient/);
	});

	it('should use gradient stroke for score < 40', () => {
		const { container } = render(ScoreRing, { props: { score: 20 } });
		const circles = container.querySelectorAll('circle');
		const scoreCircle = circles[1];
		expect(scoreCircle?.getAttribute('stroke')).toMatch(/url\(#score-gradient/);
	});

	it('should render two circles (background + score)', () => {
		const { container } = render(ScoreRing, { props: { score: 50 } });
		const circles = container.querySelectorAll('circle');
		expect(circles).toHaveLength(2);
	});

	it('should calculate correct stroke-dashoffset for 100%', () => {
		const size = 120;
		const strokeWidth = 8;
		const radius = (size - strokeWidth) / 2;
		const circumference = 2 * Math.PI * radius;
		const expectedOffset = circumference - (100 / 100) * circumference;

		const { container } = render(ScoreRing, { props: { score: 100 } });
		const scoreCircle = container.querySelectorAll('circle')[1];
		expect(Number(scoreCircle?.getAttribute('stroke-dashoffset'))).toBeCloseTo(
			expectedOffset, 1
		);
	});

	it('should calculate correct stroke-dashoffset for 0%', () => {
		const size = 120;
		const strokeWidth = 8;
		const radius = (size - strokeWidth) / 2;
		const circumference = 2 * Math.PI * radius;

		const { container } = render(ScoreRing, { props: { score: 0 } });
		const scoreCircle = container.querySelectorAll('circle')[1];
		expect(Number(scoreCircle?.getAttribute('stroke-dashoffset'))).toBeCloseTo(
			circumference, 1
		);
	});
});
