import { Download } from 'lucide-react'

const SUB_PROCESSORS = [
  { name: 'Cloudflare, Inc.', purpose: 'CDN, DDoS protection, DNS, edge compute', location: 'USA (global edge)' },
  { name: 'Render Services, Inc.', purpose: 'Application hosting, managed PostgreSQL', location: 'USA (Oregon)' },
  { name: 'Crunchy Data Solutions', purpose: 'Managed PostgreSQL (production database)', location: 'USA' },
  { name: 'LemonSqueezy (Lemon Squeezy, LLC)', purpose: 'Subscription billing, payment processing', location: 'USA' },
  { name: 'Resend, Inc.', purpose: 'Transactional email delivery', location: 'USA' },
  { name: 'Twilio, Inc.', purpose: 'SMS delivery (MFA, notifications)', location: 'USA' },
  { name: 'OpenAI, Inc.', purpose: 'LLM inference for AI-assisted screening summaries', location: 'USA' },
  { name: 'Anthropic, PBC', purpose: 'LLM inference for AI-assisted screening summaries', location: 'USA' },
  { name: 'OpenSanctions', purpose: 'Consolidated sanctions and PEP data', location: 'Germany' },
] as const

const EFFECTIVE_DATE = 'May 19, 2026'

export default function DPAPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 py-20">
      <p className="section-eyebrow mb-4">Legal</p>
      <h1 className="text-4xl font-bold tracking-tight mb-3 sf-title">
        Data Processing Agreement
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--dash-text-secondary)' }}>
        Effective date: {EFFECTIVE_DATE}
      </p>

      <div className="mb-10">
        <a
          href="/legal/AMLIQ_DPA.pdf"
          download
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: 'var(--dash-accent, #C9A96E)',
            color: '#fff',
          }}
        >
          <Download size={16} />
          Download PDF
        </a>
      </div>

      <div className="space-y-8 leading-relaxed" style={{ color: 'var(--dash-text-secondary)' }}>
        <Section title="1. Parties and Scope">
          <p>
            This Data Processing Agreement (&ldquo;DPA&rdquo;) forms part of the
            service agreement between <strong>AMLIQ Technologies Ltd</strong>
            (&ldquo;Processor&rdquo;) and the entity subscribing to AMLIQ
            services (&ldquo;Controller&rdquo;). It governs the processing of
            personal data by the Processor on behalf of the Controller when
            providing sanctions screening, PEP screening, and adverse-media
            monitoring services (&ldquo;Services&rdquo;).
          </p>
        </Section>

        <Section title="2. Definitions">
          <p>
            &ldquo;Personal Data,&rdquo; &ldquo;Processing,&rdquo;
            &ldquo;Data Subject,&rdquo; &ldquo;Controller,&rdquo;
            &ldquo;Processor,&rdquo; and &ldquo;Supervisory Authority&rdquo;
            have the meanings given in the EU General Data Protection Regulation
            (Regulation 2016/679, &ldquo;GDPR&rdquo;) or, where applicable, the
            UK Data Protection Act 2018.
          </p>
        </Section>

        <Section title="3. Subject Matter and Duration">
          <p>
            The Processor processes Personal Data solely to perform the Services
            described in the applicable service agreement. Processing continues
            for the duration of the service agreement, plus any retention period
            specified below or required by law.
          </p>
        </Section>

        <Section title="4. Nature and Purpose of Processing">
          <ul className="list-disc pl-5 space-y-1">
            <li>Receiving screening queries containing name, date of birth, nationality, and other identifiers provided by the Controller.</li>
            <li>Matching query data against sanctions, PEP, and adverse-media datasets.</li>
            <li>Returning match results, risk scores, and AI-generated summaries.</li>
            <li>Storing audit logs of screening events for the retention window configured by the Controller (default: 90 days).</li>
          </ul>
        </Section>

        <Section title="5. Categories of Data Subjects">
          <p>
            Individuals screened by the Controller, including customers,
            beneficial owners, counterparties, and any other persons submitted
            for sanctions or PEP screening.
          </p>
        </Section>

        <Section title="6. Types of Personal Data">
          <p>
            Full name, aliases, date of birth, nationality, country of
            residence, government-issued identification numbers, and any
            additional identifiers submitted by the Controller in screening
            requests.
          </p>
        </Section>

        <Section title="7. Obligations of the Controller">
          <ul className="list-disc pl-5 space-y-1">
            <li>Ensure a lawful basis exists for submitting Personal Data to the Processor.</li>
            <li>Provide clear processing instructions and notify the Processor of any changes.</li>
            <li>Inform Data Subjects of the processing as required by applicable law.</li>
          </ul>
        </Section>

        <Section title="8. Obligations of the Processor">
          <ul className="list-disc pl-5 space-y-1">
            <li>Process Personal Data only on documented instructions from the Controller, unless required by EU or Member State law.</li>
            <li>Ensure that persons authorised to process Personal Data have committed to confidentiality.</li>
            <li>Implement appropriate technical and organizational security measures (see Section 10).</li>
            <li>Assist the Controller in responding to Data Subject requests and in meeting GDPR obligations (Articles 32–36).</li>
            <li>Delete or return all Personal Data at the end of the service agreement, at the Controller&rsquo;s election, unless retention is required by law.</li>
          </ul>
        </Section>

        <Section title="9. Sub-processors">
          <p className="mb-4">
            The Controller provides general written authorization for the
            Processor to engage the sub-processors listed below. The Processor
            will notify the Controller at least <strong>30 days</strong> before
            adding or replacing a sub-processor. The Controller may object
            within that period; if the objection cannot be resolved, either
            party may terminate the affected Services.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--dash-border, #e5e5e2)' }}>
                  <th className="text-left py-2 pr-4 font-semibold" style={{ color: 'var(--dash-text)' }}>Sub-processor</th>
                  <th className="text-left py-2 pr-4 font-semibold" style={{ color: 'var(--dash-text)' }}>Purpose</th>
                  <th className="text-left py-2 font-semibold" style={{ color: 'var(--dash-text)' }}>Location</th>
                </tr>
              </thead>
              <tbody>
                {SUB_PROCESSORS.map((sp) => (
                  <tr key={sp.name} className="border-b" style={{ borderColor: 'var(--dash-border, #e5e5e2)' }}>
                    <td className="py-2 pr-4">{sp.name}</td>
                    <td className="py-2 pr-4">{sp.purpose}</td>
                    <td className="py-2">{sp.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="10. Security Measures">
          <ul className="list-disc pl-5 space-y-1">
            <li>AES-256-GCM encryption of sensitive fields at the application layer before storage.</li>
            <li>TLS 1.3 for all data in transit; HSTS enforced.</li>
            <li>Logical tenant isolation across application, cache, and database layers.</li>
            <li>Role-based access control (RBAC) with Admin, Analyst, and Viewer roles.</li>
            <li>Multi-factor authentication available for all dashboard users.</li>
            <li>Append-only, hash-chained audit log for all screening and configuration events.</li>
            <li>Continuous dependency scanning and automated CVE patching.</li>
            <li>Regular internal security reviews; third-party penetration testing planned ahead of commercial launch.</li>
          </ul>
        </Section>

        <Section title="11. Data Breach Notification">
          <p>
            The Processor will notify the Controller without undue delay, and in
            any event within <strong>48 hours</strong>, after becoming aware of a
            Personal Data breach. The notification will include the nature of the
            breach, categories and approximate number of Data Subjects affected,
            likely consequences, and measures taken or proposed to mitigate the
            breach.
          </p>
        </Section>

        <Section title="12. International Transfers">
          <p>
            Where Personal Data is transferred outside the EEA or UK, the
            Processor relies on the EU Standard Contractual Clauses
            (Commission Implementing Decision 2021/914) as set out in Annex I
            below. The UK International Data Transfer Addendum applies where the
            Controller is subject to UK GDPR.
          </p>
        </Section>

        <Section title="13. Data Subject Rights">
          <p>
            The Processor will assist the Controller in fulfilling obligations to
            respond to Data Subject requests for access, rectification, erasure,
            restriction, portability, and objection. The Processor will promptly
            redirect any request received directly from a Data Subject to the
            Controller.
          </p>
        </Section>

        <Section title="14. Audits">
          <p>
            The Processor will make available to the Controller all information
            necessary to demonstrate compliance with this DPA and allow for and
            contribute to audits, including inspections, conducted by the
            Controller or an auditor mandated by the Controller, subject to
            reasonable notice and confidentiality obligations.
          </p>
        </Section>

        <Section title="15. Term and Termination">
          <p>
            This DPA takes effect on the date the Controller first accesses the
            Services and remains in force until all Personal Data is deleted or
            returned. Obligations that by their nature should survive termination
            (confidentiality, audit rights, breach notification) will survive.
          </p>
        </Section>

        <hr className="my-8" style={{ borderColor: 'var(--dash-border, #e5e5e2)' }} />

        <Section title="Annex I — Standard Contractual Clauses (Module Two: Controller to Processor)">
          <p>
            The parties agree to be bound by the EU Standard Contractual Clauses
            (Module Two) as adopted by the European Commission in Implementing
            Decision (EU) 2021/914. The details required by the SCCs are:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-3">
            <li><strong>Data exporter:</strong> The Controller, as identified in the service agreement.</li>
            <li><strong>Data importer:</strong> AMLIQ Technologies Ltd.</li>
            <li><strong>Description of transfer:</strong> As set out in Sections 4–6 of this DPA.</li>
            <li><strong>Competent supervisory authority:</strong> The supervisory authority of the Member State in which the data exporter is established.</li>
            <li><strong>Technical and organizational measures:</strong> As set out in Section 10 of this DPA.</li>
          </ul>
        </Section>

        <Section title="Annex II — UK International Data Transfer Addendum">
          <p>
            Where the Controller is subject to the UK GDPR, the UK International
            Data Transfer Addendum to the EU SCCs (as issued by the ICO under
            Section 119A of the Data Protection Act 2018) is incorporated by
            reference and applies to transfers of Personal Data from the UK.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Data Protection Officer:{' '}
            <a href="mailto:dpo@amliq.finance" style={{ color: 'var(--dash-accent, #C9A96E)' }}>
              dpo@amliq.finance
            </a>
          </p>
          <p>
            DPA and compliance inquiries:{' '}
            <a href="mailto:compliance@amliq.finance" style={{ color: 'var(--dash-accent, #C9A96E)' }}>
              compliance@amliq.finance
            </a>
          </p>
        </Section>
      </div>
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-card rounded-apple-lg p-lg">
      <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--dash-text)' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}
