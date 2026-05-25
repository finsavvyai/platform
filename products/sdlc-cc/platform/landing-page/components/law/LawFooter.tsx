const LawFooter = () => {
  const year = new Date().getFullYear();

  return (
    <footer
      className="border-t-2 law-rule"
      style={{ background: 'var(--law-paper-deep)' }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
          <div>
            <p
              className="text-base font-semibold"
              style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
            >
              sdlc.cc
            </p>
            <p className="mt-2 text-sm law-muted leading-relaxed">
              Self-hosted LLM gateway with attorney-client privilege
              protection.
            </p>
          </div>

          <div>
            <p
              className="law-cite mb-3"
              style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
            >
              Code
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://github.com/finsavvyai/sdlc-platform"
                  className="hover:underline"
                  rel="noopener noreferrer"
                >
                  GitHub repository
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/finsavvyai/sdlc-platform/blob/main/COMMERCIAL.md"
                  className="hover:underline"
                  rel="noopener noreferrer"
                >
                  COMMERCIAL.md
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/finsavvyai/sdlc-platform/blob/main/LICENSE"
                  className="hover:underline"
                  rel="noopener noreferrer"
                >
                  AGPL-3.0 license
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p
              className="law-cite mb-3"
              style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
            >
              Contact
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="mailto:commercial@sdlc.cc" className="hover:underline">
                  commercial@sdlc.cc
                </a>
                <span className="block text-xs law-muted">
                  Licensing & enterprise sales
                </span>
              </li>
              <li>
                <a href="mailto:hello@sdlc.cc" className="hover:underline">
                  hello@sdlc.cc
                </a>
                <span className="block text-xs law-muted">
                  General inquiries
                </span>
              </li>
            </ul>
          </div>

          <div>
            <p
              className="law-cite mb-3"
              style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
            >
              Disclosure
            </p>
            <p className="text-sm law-muted leading-relaxed">
              sdlc.cc is dual-licensed: AGPL-3.0 for open-source use, separate
              commercial license for proprietary production deployments. Not a
              law firm. Not legal advice. Cited authorities (ABA Model Rules,
              FRCP, Formal Opinion 512) are referenced for orientation; consult
              your general counsel.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t law-rule flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs law-muted">
            © {year} sdlc.cc contributors. Code: AGPL-3.0. Commercial license
            available.
          </p>
          <p className="text-xs law-muted">
            Built for 50–500 attorney firms.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default LawFooter;
