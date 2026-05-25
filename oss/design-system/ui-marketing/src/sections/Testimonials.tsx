import React from 'react';

export interface Testimonial {
  quote: string;
  author: string;
  company: string;
}

interface TestimonialsProps {
  testimonials: Testimonial[];
}

export const Testimonials: React.FC<TestimonialsProps> = ({ testimonials }) => {
  const containerStyle: React.CSSProperties = {
    padding: '60px 40px',
    backgroundColor: '#F2F2F7',
    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  };

  const cardStyle: React.CSSProperties = {
    padding: '24px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #E5E5EA',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  };

  const quoteStyle: React.CSSProperties = {
    fontSize: '14px',
    fontStyle: 'italic',
    color: '#3C3C43',
    marginBottom: '16px',
    lineHeight: '1.6',
  };

  const authorStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#000000',
    marginBottom: '4px',
  };

  const companyStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#8E8E93',
  };

  return (
    <section style={containerStyle} data-testid="testimonials">
      <div style={gridStyle} data-testid="testimonials-grid">
        {testimonials.map((testimonial, idx) => (
          <div
            key={idx}
            style={cardStyle}
            data-testid={`testimonial-${idx}`}
          >
            <p style={quoteStyle}>"{testimonial.quote}"</p>
            <div>
              <p style={authorStyle}>{testimonial.author}</p>
              <p style={companyStyle}>{testimonial.company}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

Testimonials.displayName = 'Testimonials';
