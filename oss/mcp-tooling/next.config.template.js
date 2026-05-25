const { createNextConfig } = require('@mcpoverflow/frontend-config')

// Get the domain type from environment variable
const domainType = process.env.NEXT_PUBLIC_DOMAIN_TYPE || 'marketing'

// Create domain-specific configuration
const config = createNextConfig(domainType)

// Export the configuration
module.exports = config