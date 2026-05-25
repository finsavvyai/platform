/** Marketplace browse, install, publish, rate, bundles, and skill endpoints */
export const marketplaceBrowseSection = {
  title: 'Marketplace',
  description: 'Browse, search, and discover skills',
  endpoints: [
    {
      method: 'GET',
      path: '/api/marketplace',
      auth: 'bearer (marketplace.browse)',
      description: 'List all published skills with filtering and pagination',
      queryParams: { category: 'string?', search: 'string?', page: 'number?' },
      response: { data: 'Skill[]' },
    },
    {
      method: 'GET',
      path: '/api/marketplace/featured',
      auth: 'bearer (marketplace.browse)',
      description: 'List featured/promoted skills',
      response: { data: 'Skill[]' },
    },
    {
      method: 'GET',
      path: '/api/marketplace/:id',
      auth: 'bearer (marketplace.browse)',
      description: 'Get skill detail with ratings and install count',
      response: { data: 'Skill' },
    },
    {
      method: 'GET',
      path: '/api/marketplace/recommendations',
      auth: 'bearer',
      description: 'AI-powered skill recommendations based on usage',
      response: { data: 'Recommendation[]' },
    },
  ],
} as const;

export const marketplaceInstallSection = {
  title: 'Marketplace Install',
  description: 'Install and uninstall marketplace skills',
  endpoints: [
    {
      method: 'POST',
      path: '/api/marketplace/:id/install',
      auth: 'bearer (marketplace.install)',
      description: 'Install a skill from the marketplace',
      response: { data: 'SkillInstallation' },
    },
    {
      method: 'DELETE',
      path: '/api/marketplace/:id/install',
      auth: 'bearer (marketplace.install)',
      description: 'Uninstall a marketplace skill',
      response: 'null (204)',
    },
    {
      method: 'GET',
      path: '/api/marketplace/installed',
      auth: 'bearer (marketplace.browse)',
      description: 'List currently installed skills',
      response: { data: 'SkillInstallation[]' },
    },
  ],
} as const;

export const marketplacePublishSection = {
  title: 'Marketplace Publish',
  description: 'Publish and manage your own skills',
  endpoints: [
    {
      method: 'POST',
      path: '/api/marketplace/publish',
      auth: 'bearer (marketplace.publish)',
      description: 'Submit a skill for marketplace review',
      requestBody: { name: 'string', slug: 'string', description: 'string', version: 'string' },
      response: { data: 'Skill' },
    },
    {
      method: 'GET',
      path: '/api/marketplace/my-skills',
      auth: 'bearer (marketplace.publish)',
      description: 'List skills published by the current user',
      response: { data: 'Skill[]' },
    },
    {
      method: 'PATCH',
      path: '/api/marketplace/my-skills/:id',
      auth: 'bearer (marketplace.publish)',
      description: 'Update a published skill',
      response: { data: 'Skill' },
    },
  ],
} as const;

export const marketplaceRateSection = {
  title: 'Marketplace Ratings',
  description: 'Rate and review marketplace skills',
  endpoints: [
    {
      method: 'POST',
      path: '/api/marketplace/:id/rate',
      auth: 'bearer (marketplace.browse)',
      description: 'Submit a rating for a skill',
      requestBody: { rating: 'number (1-5)', review: 'string?' },
      response: { data: 'Rating' },
    },
    {
      method: 'GET',
      path: '/api/marketplace/:id/ratings',
      auth: 'bearer (marketplace.browse)',
      description: 'List ratings for a skill',
      response: { data: 'Rating[]' },
    },
  ],
} as const;

export const bundleSection = {
  title: 'Skill Bundles',
  description: 'Curated skill bundles for common use cases',
  endpoints: [
    {
      method: 'GET',
      path: '/api/bundles',
      auth: 'bearer (marketplace.browse)',
      description: 'List available skill bundles',
      response: { data: 'Bundle[]' },
    },
    {
      method: 'POST',
      path: '/api/bundles/:id/activate',
      auth: 'bearer (marketplace.browse)',
      description: 'Activate a bundle (installs all included skills)',
      response: { data: 'BundleSubscription' },
    },
    {
      method: 'GET',
      path: '/api/user/bundles',
      auth: 'bearer (marketplace.browse)',
      description: 'List user activated bundles',
      response: { data: 'BundleSubscription[]' },
    },
  ],
} as const;

export const publicSkillSection = {
  title: 'Public Skills',
  description: 'Unauthenticated skill browsing',
  endpoints: [
    {
      method: 'GET',
      path: '/api/skills',
      auth: 'none',
      description: 'List all published skills (public catalog)',
      response: { data: 'Skill[]' },
    },
    {
      method: 'GET',
      path: '/api/skills/:slug',
      auth: 'none',
      description: 'Get skill by slug',
      response: { data: 'Skill' },
    },
    {
      method: 'POST',
      path: '/api/skills/submit',
      auth: 'bearer',
      description: 'Submit a skill for review (legacy)',
      requestBody: { name: 'string', slug: 'string', description: 'string' },
      response: { data: 'Skill' },
    },
  ],
} as const;
