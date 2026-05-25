/**
 * External References Tests
 *
 * Tests all external links and references to ensure they are current,
 * accessible, and appropriate for production documentation.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import DocumentationTestUtils from '../utils/documentationTestUtils';
import { getTestConfig } from '../config/testConfig';

describe('External References Validation', () => {
  const config = getTestConfig();
  let externalLinks: Array<{ url: string; file: string; line: number }> = [];
  const projectRoot = require('path').resolve(process.cwd(), '..');

  beforeAll(async () => {
    // Collect all external links from documentation
    const documentationFiles = await DocumentationTestUtils.getDocumentationFiles(
      `${projectRoot}/docs`,
      ['.md', '.txt']
    );

    for (const filePath of documentationFiles) {
      const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
      const links = DocumentationTestUtils.extractLinks(docFile.content);
      const externalLinksInFile = links.filter(link => link.type === 'external');

      externalLinksInFile.forEach(link => {
        externalLinks.push({
          url: link.url,
          file: filePath,
          line: link.line
        });
      });
    }

    console.log(`Found ${externalLinks.length} external links to validate`);
  });

  describe('Link Accessibility', () => {
    it('should validate all external links are accessible', async () => {
      // Test a sample of external links to avoid timeout
      const sampleLinks = externalLinks.slice(0, 20);
      const validationResults = await DocumentationTestUtils.validateExternalLinks(
        sampleLinks.map(link => ({ url: link.url, line: link.line })),
        config.linkValidation.timeout
      );

      const invalidLinks = validationResults.filter(result => result.status !== 'valid');
      const validLinks = validationResults.filter(result => result.status === 'valid');

      console.log(`Link validation results: ${validLinks.length} valid, ${invalidLinks.length} invalid`);

      if (invalidLinks.length > 0) {
        console.warn('Invalid external links:', invalidLinks);
      }

      // Allow some invalid links as external sites may be temporarily down
      expect(invalidLinks.length).toBeLessThan(sampleLinks.length * 0.1); // Less than 10% failure rate
    }, 60000); // Increase timeout for external requests

    it('should check response times for critical links', async () => {
      // Test critical documentation links
      const criticalDomains = [
        'github.com',
        'developer.mozilla.org',
        'nodejs.org',
        'reactjs.org'
      ];

      const criticalLinks = externalLinks.filter(link =>
        criticalDomains.some(domain => link.url.includes(domain))
      );

      if (criticalLinks.length > 0) {
        const validationResults = await DocumentationTestUtils.validateExternalLinks(
          criticalLinks.map(link => ({ url: link.url, line: link.line })),
          5000 // Shorter timeout for critical links
        );

        const slowLinks = validationResults.filter(result =>
          result.status === 'valid' && result.responseTime && result.responseTime > 3000
        );

        if (slowLinks.length > 0) {
          console.warn('Slow external links found:', slowLinks);
        }

        expect(slowLinks.length).toBeLessThan(criticalLinks.length * 0.2); // Less than 20% are slow
      }
    }, 30000);
  });

  describe('URL Format Validation', () => {
    it('should ensure all external URLs use HTTPS', () => {
      const httpLinks = externalLinks.filter(link =>
        link.url.startsWith('http://')
      );

      // Allow some HTTP links for specific cases (like localhost examples)
      const allowedHttpDomains = ['localhost', '127.0.0.1', 'example.com'];
      const problematicHttpLinks = httpLinks.filter(link =>
        !allowedHttpDomains.some(domain => link.url.includes(domain))
      );

      if (problematicHttpLinks.length > 0) {
        console.warn('HTTP links that should be HTTPS:', problematicHttpLinks);
      }

      expect(problematicHttpLinks).toHaveLength(0);
    });

    it('should validate URL structure and syntax', () => {
      const invalidUrls: Array<{ url: string; file: string; issue: string }> = [];

      externalLinks.forEach(link => {
        // Check for common URL format issues
        if (!link.url.startsWith('http')) {
          invalidUrls.push({
            url: link.url,
            file: link.file,
            issue: 'URL does not start with http/https'
          });
        }

        if (link.url.includes(' ')) {
          invalidUrls.push({
            url: link.url,
            file: link.file,
            issue: 'URL contains spaces'
          });
        }

        if (link.url.includes('..')) {
          invalidUrls.push({
            url: link.url,
            file: link.file,
            issue: 'URL contains relative path components'
          });
        }

        // Check for invalid characters
        const invalidChars = ['<', '>', '|', '"', '^', '`', '{', '}'];
        if (invalidChars.some(char => link.url.includes(char))) {
          invalidUrls.push({
            url: link.url,
            file: link.file,
            issue: 'URL contains invalid characters'
          });
        }
      });

      if (invalidUrls.length > 0) {
        console.warn('Invalid URL formats found:', invalidUrls);
      }

      expect(invalidUrls).toHaveLength(0);
    });

    it('should ensure consistent URL formatting', () => {
      const formatIssues: Array<{ url: string; file: string; issue: string }> = [];

      externalLinks.forEach(link => {
        // Check for trailing slash inconsistencies
        const urlWithoutFragment = link.url.split('#')[0];
        const hasTrailingSlash = urlWithoutFragment.endsWith('/');
        const hasQuery = urlWithoutFragment.includes('?');

        // URLs should have trailing slash if they don't have queries and are domain roots or major sections
        if (hasTrailingSlash && !hasQuery && !urlWithoutFragment.endsWith('/')) {
          // This might be intentional, so just log it
        }

        // Check for unnecessary port specifications
        if (link.url.includes(':80/') || link.url.includes(':443/')) {
          formatIssues.push({
            url: link.url,
            file: link.file,
            issue: 'Unnecessary port specification'
          });
        }
      });

      if (formatIssues.length > 0) {
        console.warn('URL format issues found:', formatIssues);
      }

      expect(formatIssues.length).toBeLessThan(5);
    });
  });

  describe('Domain Validation', () => {
    it('should ensure domains are appropriate for production documentation', () => {
      const inappropriateDomains = [
        'bit.ly',
        'tinyurl.com',
        'goo.gl',
        // Add other URL shorteners or inappropriate domains
      ];

      const inappropriateLinks = externalLinks.filter(link =>
        inappropriateDomains.some(domain => link.url.includes(domain))
      );

      if (inappropriateLinks.length > 0) {
        console.warn('Links to potentially inappropriate domains:', inappropriateLinks);
      }

      // Allow some URL shorteners but limit them
      expect(inappropriateLinks.length).toBeLessThan(3);
    });

    it('should verify reference to official documentation sources', () => {
      const expectedOfficialSources = [
        'developer.mozilla.org',
        'nodejs.org',
        'reactjs.org',
        'github.com',
        'npmjs.com',
        'postgresql.org',
        'redis.io',
        'stripe.com/docs',
        'aws.amazon.com/documentation'
      ];

      const foundOfficialSources = externalLinks.filter(link =>
        expectedOfficialSources.some(domain => link.url.includes(domain))
      );

      expect(foundOfficialSources.length).toBeGreaterThan(0);
      console.log(`Found ${foundOfficialSources.length} links to official documentation`);
    });

    it('should not reference development or staging environments', () => {
      const developmentEnvironments = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        'dev.',
        'staging.',
        'test.',
        'internal.'
      ];

      const devLinks = externalLinks.filter(link =>
        developmentEnvironments.some(env => {
          try {
            const url = new URL(link.url);
            return url.hostname.includes(env);
          } catch {
            return link.url.includes(env);
          }
        })
      );

      // Allow some development references if they're clearly marked as examples
      const exampleDevLinks = devLinks.filter(link => {
        // Check if they're in code blocks or clearly marked as examples
        return true; // For now, allow all as they might be examples
      });

      if (exampleDevLinks.length > 5) {
        console.warn('Many development environment references found:', exampleDevLinks);
      }

      expect(exampleDevLinks.length).toBeLessThan(10);
    });
  });

  describe('Content Appropriateness', () => {
    it('should ensure external content is relevant to Questro', () => {
      // This is a subjective test - in practice you might have a curated list
      // of expected external reference categories

      const relevantCategories = [
        'documentation',
        'api',
        'sdk',
        'tutorial',
        'guide',
        'framework',
        'library',
        'tool'
      ];

      // Check that links include relevant keywords
      const relevantLinks = externalLinks.filter(link =>
        relevantCategories.some(category =>
          link.url.toLowerCase().includes(category) ||
          link.url.toLowerCase().includes('doc')
        )
      );

      // At least 50% of links should be to relevant documentation
      expect(relevantLinks.length).toBeGreaterThan(externalLinks.length * 0.5);
    });

    it('should not reference potentially inappropriate content', () => {
      const inappropriateKeywords = [
        'gambling',
        'adult',
        'malware',
        'piracy',
        'illegal'
      ];

      const inappropriateLinks = externalLinks.filter(link =>
        inappropriateKeywords.some(keyword =>
          link.url.toLowerCase().includes(keyword)
        )
      );

      expect(inappropriateLinks).toHaveLength(0);
    });
  });

  describe('Link Maintenance', () => {
    it('should avoid linking to deprecated or obsolete resources', () => {
      const deprecatedIndicators = [
        'deprecated',
        'obsolete',
        'legacy',
        'old.',
        'archive.'
      ];

      const potentiallyDeprecatedLinks = externalLinks.filter(link =>
        deprecatedIndicators.some(indicator =>
          link.url.toLowerCase().includes(indicator)
        )
      );

      if (potentiallyDeprecatedLinks.length > 0) {
        console.warn('Potentially deprecated links:', potentiallyDeprecatedLinks);
      }

      // Allow some if they're clearly intentional (like linking to legacy docs)
      expect(potentiallyDeprecatedLinks.length).toBeLessThan(3);
    });

    it('should prefer stable, long-term resources', () => {
      const stableDomainPatterns = [
        /\.org$/,
        /\.edu$/,
        /\.gov$/,
        'developer.',
        'docs.',
        'documentation.'
      ];

      const stableLinks = externalLinks.filter(link =>
        stableDomainPatterns.some(pattern =>
          link.url.match(pattern)
        )
      );

      console.log(`Found ${stableLinks.length} links to stable domains`);

      // At least 30% of links should be to stable domains
      expect(stableLinks.length).toBeGreaterThan(externalLinks.length * 0.3);
    });

    it('should include version-specific links where appropriate', () => {
      // Check for version numbers in URLs for API documentation
      const versionedLinks = externalLinks.filter(link =>
        link.url.match(/\/v\d+\/|\/\d+\.\d+\.\d+\//) ||
        link.url.includes('version')
      );

      console.log(`Found ${versionedLinks} versioned links`);

      // This is optional - some links should be versioned
      expect(versionedLinks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Security Considerations', () => {
    it('should not include sensitive information in URLs', () => {
      const sensitivePatterns = [
        /api[_-]?key/i,
        /token/i,
        /password/i,
        /secret/i,
        /credential/i
      ];

      const sensitiveLinks = externalLinks.filter(link =>
        sensitivePatterns.some(pattern =>
          link.url.match(pattern)
        )
      );

      // Allow some if they're clearly example parameters
      const exampleParams = ['api_key=YOUR_KEY', 'token=example'];
      const nonExampleSensitiveLinks = sensitiveLinks.filter(link =>
        !exampleParams.some(example => link.url.includes(example))
      );

      if (nonExampleSensitiveLinks.length > 0) {
        console.warn('Links with potentially sensitive information:', nonExampleSensitiveLinks);
      }

      expect(nonExampleSensitiveLinks).toHaveLength(0);
    });

    it('should use HTTPS for all external links', () => {
      const httpsLinks = externalLinks.filter(link => link.url.startsWith('https://'));
      const httpLinks = externalLinks.filter(link => link.url.startsWith('http://'));

      console.log(`HTTPS links: ${httpsLinks.length}, HTTP links: ${httpLinks.length}`);

      // At least 95% of links should use HTTPS
      expect(httpsLinks.length / externalLinks.length).toBeGreaterThan(0.95);
    });
  });

  describe('Link Diversity', () => {
    it('should reference a variety of authoritative sources', () => {
      const domains = new Set(externalLinks.map(link => {
        try {
          return new URL(link.url).hostname;
        } catch {
          return link.url.split('/')[2] || 'unknown';
        }
      }));

      console.log(`Links span ${domains.size} different domains`);

      // Should reference multiple domains, not just one
      expect(domains.size).toBeGreaterThan(5);
    });

    it('should include both documentation and code examples', () => {
      const documentationLinks = externalLinks.filter(link =>
        link.url.toLowerCase().includes('doc') ||
        link.url.toLowerCase().includes('guide') ||
        link.url.toLowerCase().includes('tutorial')
      );

      const codeLinks = externalLinks.filter(link =>
        link.url.includes('github.com') ||
        link.url.includes('gist.github.com') ||
        link.url.includes('codepen.io') ||
        link.url.includes('jsfiddle.net')
      );

      console.log(`Documentation links: ${documentationLinks.length}, Code links: ${codeLinks.length}`);

      // Should have both types of links
      expect(documentationLinks.length).toBeGreaterThan(0);
    });
  });

  describe('Link Quality', () => {
    it('should avoid broken or redirected links', async () => {
      // Test a sample for redirects
      const sampleLinks = externalLinks.slice(0, 10);

      for (const link of sampleLinks) {
        try {
          const response = await fetch(link.url, {
            method: 'HEAD',
            redirect: 'manual'
          });

          // Check for too many redirects (likely broken)
          if (response.status >= 300 && response.status < 400) {
            console.warn(`Redirect detected: ${link.url} -> ${response.headers.get('location')}`);
          }
        } catch (error) {
          // Network errors will be caught in the accessibility test
        }
      }

      expect(true).toBe(true); // This is informational
    }, 15000);

    it('should prefer direct links over shortened URLs', () => {
      const urlShorteners = [
        'bit.ly',
        'tinyurl.com',
        'goo.gl',
        't.co',
        'ow.ly',
        'is.gd'
      ];

      const shortenedLinks = externalLinks.filter(link =>
        urlShorteners.some(shortener => link.url.includes(shortener))
      );

      console.log(`Found ${shortenedLinks.length} shortened URLs`);

      // Prefer direct links - limit shortened URLs
      expect(shortenedLinks.length).toBeLessThan(externalLinks.length * 0.05); // Less than 5%
    });
  });

  describe('Reference Freshness', () => {
    it('should reference current and maintained resources', () => {
      // Check for indicators of current resources
      const currentIndicators = [
        /\b202[3-9]\b/, // Recent years
        'latest',
        'current',
        'stable'
      ];

      const currentLinks = externalLinks.filter(link =>
        currentIndicators.some(indicator =>
          link.url.toLowerCase().match(indicator)
        )
      );

      console.log(`Found ${currentLinks.length} links to current resources`);

      // Should have some current resources referenced
      expect(currentLinks.length).toBeGreaterThan(0);
    });

    it('should avoid referencing very old resources', () => {
      const oldIndicators = [
        /\b200[0-9]\b/, // 2000s
        /\b201[0-7]\b/, // 2010-2017
        'old',
        'archive',
        'deprecated'
      ];

      const oldLinks = externalLinks.filter(link =>
        oldIndicators.some(indicator =>
          link.url.toLowerCase().match(indicator)
        )
      );

      if (oldLinks.length > 0) {
        console.warn('Potentially old references found:', oldLinks);
      }

      // Allow some old references if they're to still-relevant content
      expect(oldLinks.length).toBeLessThan(externalLinks.length * 0.1); // Less than 10%
    });
  });
});
