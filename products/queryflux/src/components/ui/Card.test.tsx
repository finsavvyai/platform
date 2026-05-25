import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './Card';

describe('Card', () => {
  it('renders with children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('forwards className', () => {
    render(<Card className="my-class">Content</Card>);
    const card = screen.getByText('Content');
    expect(card.className).toContain('my-class');
  });

  it('forwards ref', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Card ref={ref}>Content</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('CardHeader', () => {
  it('renders with children', () => {
    render(<CardHeader>Header content</CardHeader>);
    expect(screen.getByText('Header content')).toBeInTheDocument();
  });

  it('forwards className', () => {
    render(<CardHeader className="header-class">Header</CardHeader>);
    const el = screen.getByText('Header');
    expect(el.className).toContain('header-class');
  });

  it('forwards ref', () => {
    const ref = createRef<HTMLDivElement>();
    render(<CardHeader ref={ref}>Header</CardHeader>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('CardTitle', () => {
  it('renders as h3', () => {
    render(<CardTitle>Title</CardTitle>);
    const heading = screen.getByRole('heading', { name: /Title/i });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe('H3');
  });

  it('forwards className', () => {
    render(<CardTitle className="title-class">Title</CardTitle>);
    const heading = screen.getByRole('heading', { name: /Title/i });
    expect(heading.className).toContain('title-class');
  });

  it('forwards ref', () => {
    const ref = createRef<HTMLParagraphElement>();
    render(<CardTitle ref={ref}>Title</CardTitle>);
    expect(ref.current).toBeTruthy();
  });
});

describe('CardDescription', () => {
  it('renders with children', () => {
    render(<CardDescription>Description text</CardDescription>);
    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('forwards className', () => {
    render(<CardDescription className="desc-class">Desc</CardDescription>);
    const el = screen.getByText('Desc');
    expect(el.className).toContain('desc-class');
  });

  it('forwards ref', () => {
    const ref = createRef<HTMLParagraphElement>();
    render(<CardDescription ref={ref}>Desc</CardDescription>);
    expect(ref.current).toBeInstanceOf(HTMLParagraphElement);
  });
});

describe('CardContent', () => {
  it('renders with children', () => {
    render(<CardContent>Body content</CardContent>);
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('forwards className', () => {
    render(<CardContent className="content-class">Body</CardContent>);
    const el = screen.getByText('Body');
    expect(el.className).toContain('content-class');
  });

  it('forwards ref', () => {
    const ref = createRef<HTMLDivElement>();
    render(<CardContent ref={ref}>Body</CardContent>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('CardFooter', () => {
  it('renders with children', () => {
    render(<CardFooter>Footer content</CardFooter>);
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });

  it('forwards className', () => {
    render(<CardFooter className="footer-class">Footer</CardFooter>);
    const el = screen.getByText('Footer');
    expect(el.className).toContain('footer-class');
  });

  it('forwards ref', () => {
    const ref = createRef<HTMLDivElement>();
    render(<CardFooter ref={ref}>Footer</CardFooter>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
