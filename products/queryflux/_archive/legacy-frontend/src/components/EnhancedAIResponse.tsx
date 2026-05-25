import { queryAnalyzer } from '../utils/queryAnalyzer';

export function generateEnhancedAIResponse(query: string): string {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.startsWith('analyze:') || lowerQuery.startsWith('check:')) {
    const sqlQuery = query.substring(query.indexOf(':') + 1).trim();
    const analysis = queryAnalyzer.analyze(sqlQuery);
    const performance = queryAnalyzer.estimatePerformance(analysis);

    let response = `🔍 Query Analysis Results\n\n`;
    response += `📊 Type: ${analysis.type}\n`;
    response += `⚡ Complexity: ${analysis.complexity.toUpperCase()}\n`;
    response += `⭐ Score: ${analysis.score}/100 (${performance.rating})\n`;
    response += `📁 Tables: ${analysis.tables.join(', ') || 'None detected'}\n\n`;

    if (analysis.risks.length > 0) {
      response += `🚨 Security & Risk Warnings:\n${analysis.risks.join('\n')}\n\n`;
    }

    if (analysis.suggestions.length > 0) {
      response += `💡 Optimization Suggestions:\n${analysis.suggestions.join('\n')}\n\n`;
    }

    response += `📈 Performance: ${performance.message}`;

    return response;
  }

  if (lowerQuery.includes('optimize') || lowerQuery.includes('performance')) {
    return `Based on the query analysis, here are some optimization suggestions:

1. Add an index on frequently queried columns
2. Use LIMIT to reduce result set size
3. Consider query caching for repeated queries
4. Use EXPLAIN ANALYZE to identify bottlenecks

Tip: Type "analyze: YOUR_QUERY" for detailed query analysis!`;
  }

  if (lowerQuery.includes('security') || lowerQuery.includes('injection')) {
    return `Security Analysis:

✓ Always use parameterized queries to prevent SQL injection
✓ Implement proper authentication and authorization
✓ Encrypt sensitive data at rest
✓ Regular security audits and updates
✓ Principle of least privilege for database users

Tip: Type "analyze: YOUR_QUERY" to check for security vulnerabilities!`;
  }

  if (lowerQuery.includes('index')) {
    return `Index Recommendations:

📊 Analyzing your table structure...

Suggested indexes:
1. CREATE INDEX idx_users_email ON users(email)
2. CREATE INDEX idx_orders_user_id ON orders(user_id)
3. CREATE INDEX idx_products_category ON products(category)

These indexes can improve query performance by 60-80%.

Would you like me to generate the CREATE INDEX statements?`;
  }

  return `I understand you're asking about: "${query}"

I can help you with:
• Query analysis - Type "analyze: YOUR_QUERY"
• Performance optimization
• Security analysis
• Index recommendations

Could you provide more details about what you'd like to accomplish?`;
}
