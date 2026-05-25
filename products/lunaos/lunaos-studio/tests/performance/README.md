# Performance Testing

This directory contains performance testing configuration and documentation for LunaOS Studio.

## Lighthouse CI

Lighthouse CI is configured to run performance audits on every build. The configuration is in `lighthouserc.js` at the project root.

### Performance Budgets

The following performance budgets are enforced:

- **First Contentful Paint (FCP)**: < 2 seconds
- **Largest Contentful Paint (LCP)**: < 2.5 seconds
- **Cumulative Layout Shift (CLS)**: < 0.1
- **Total Blocking Time (TBT)**: < 300ms
- **Speed Index**: < 3 seconds
- **Time to Interactive (TTI)**: < 3.5 seconds

### Resource Budgets

- **JavaScript**: < 500KB
- **CSS**: < 100KB
- **Images**: < 500KB
- **Fonts**: < 200KB

### Running Performance Tests

#### Local Testing

```bash
# Build the application first
npm run build

# Run Lighthouse CI
npm run test:performance
```

#### CI/CD Pipeline

Performance tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main`

Results are uploaded as artifacts and can be viewed in the GitHub Actions workflow.

### Interpreting Results

Lighthouse provides scores in four categories:

1. **Performance** (0-100): Measures load speed and runtime performance
2. **Accessibility** (0-100): Checks for accessibility best practices
3. **Best Practices** (0-100): Validates web development best practices
4. **SEO** (0-100): Checks search engine optimization

#### Score Ranges

- **90-100**: Good
- **50-89**: Needs improvement
- **0-49**: Poor

### Improving Performance

If performance tests fail, consider:

1. **Code Splitting**: Break large bundles into smaller chunks
2. **Lazy Loading**: Load components only when needed
3. **Image Optimization**: Compress and use modern formats (WebP)
4. **Caching**: Implement proper cache headers
5. **Minification**: Ensure all assets are minified
6. **Tree Shaking**: Remove unused code
7. **CDN**: Use a CDN for static assets

### Monitoring

Performance metrics are tracked over time. View historical data in:
- GitHub Actions artifacts
- Lighthouse CI dashboard (if configured)

### Troubleshooting

#### Build Fails

If the build fails before Lighthouse can run:
1. Check build logs for errors
2. Ensure all dependencies are installed
3. Verify environment variables are set

#### Performance Budget Exceeded

If performance budgets are exceeded:
1. Review the Lighthouse report for specific issues
2. Use Chrome DevTools Performance panel for detailed analysis
3. Check for large dependencies or unused code
4. Optimize images and other assets

#### False Positives

Sometimes tests may fail due to:
- Network conditions
- CI environment limitations
- Flaky tests

Run tests multiple times to confirm issues.

## Additional Resources

- [Lighthouse Documentation](https://developers.google.com/web/tools/lighthouse)
- [Web Vitals](https://web.dev/vitals/)
- [Performance Best Practices](https://web.dev/fast/)
