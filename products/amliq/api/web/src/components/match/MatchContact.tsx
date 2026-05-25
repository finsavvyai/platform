import React from 'react';
import { Section, Field } from './MatchSection';

interface ContactProps {
  emails?: string[]; phones?: string[];
  websites?: string[]; addresses?: string[];
}

export const ContactSection: React.FC<ContactProps> = ({
  emails, phones, websites, addresses,
}) => {
  const total = (emails?.length ?? 0) + (phones?.length ?? 0) +
    (websites?.length ?? 0) + (addresses?.length ?? 0);
  if (total === 0) return null;

  return (
    <Section title="Contact & Addresses">
      <div className="space-y-3 text-sm">
        {emails && emails.length > 0 && (
          <Field label="Email" values={emails} />
        )}
        {phones && phones.length > 0 && (
          <Field label="Phone" values={phones} />
        )}
        {websites && websites.length > 0 && (
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Websites</span>
            {websites.map((w, i) => (
              <a key={i} href={w} target="_blank" rel="noopener noreferrer"
                className="block text-blue-600 dark:text-blue-400 hover:underline
                  truncate text-sm mt-0.5 focus:outline-none focus-visible:ring-2
                  focus-visible:ring-blue-500/40 rounded">{w}</a>
            ))}
          </div>
        )}
        {addresses && addresses.length > 0 && (
          <Field label="Address" values={addresses} />
        )}
      </div>
    </Section>
  );
};
