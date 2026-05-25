import React from 'react';

interface Props {
  emails?: string[];
  phones?: string[];
  websites?: string[];
  addresses: string[];
}

export const EntityContact: React.FC<Props> = ({
  emails, phones, websites, addresses,
}) => {
  const hasData = (emails?.length ?? 0) + (phones?.length ?? 0) +
    (websites?.length ?? 0) + addresses.length > 0;
  if (!hasData) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact & Addresses</h2>
      <div className="space-y-4 text-sm">
        {emails && emails.length > 0 && (
          <Section label="Email">
            {emails.map((e, i) => <p key={i} className="text-gray-900">{e}</p>)}
          </Section>
        )}
        {phones && phones.length > 0 && (
          <Section label="Phone">
            {phones.map((p, i) => <p key={i} className="text-gray-900">{p}</p>)}
          </Section>
        )}
        {websites && websites.length > 0 && (
          <Section label="Websites">
            {websites.map((w, i) => (
              <a key={i} href={w} target="_blank" rel="noopener noreferrer"
                className="block text-blue-600 hover:underline truncate">{w}</a>
            ))}
          </Section>
        )}
        {addresses.length > 0 && (
          <Section label="Addresses">
            {addresses.map((a, i) => <p key={i} className="text-gray-900">{a}</p>)}
          </Section>
        )}
      </div>
    </div>
  );
};

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-gray-500 mb-1">{label}</dt>
    <dd>{children}</dd>
  </div>
);
