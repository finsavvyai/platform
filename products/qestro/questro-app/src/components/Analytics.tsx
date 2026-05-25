import React from 'react';
import { Helmet } from 'react-helmet-async';

interface AnalyticsProps {
  googleAnalyticsId?: string;
  googleSearchConsoleId?: string;
}

export default function Analytics({ 
  googleAnalyticsId = 'G-XXXXXXXXXX', // Replace with actual GA4 ID
  googleSearchConsoleId = 'google-site-verification-content' // Replace with actual GSC verification
}: AnalyticsProps) {
  return (
    <Helmet>
      {/* Google Analytics 4 */}
      {googleAnalyticsId && (
        <>
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
          />
          <script>
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${googleAnalyticsId}', {
                page_title: document.title,
                page_location: window.location.href,
                send_page_view: true,
                custom_map: {
                  'custom_parameter_1': 'testing_platform',
                  'custom_parameter_2': 'voice_commands',
                  'custom_parameter_3': 'ai_features'
                }
              });

              // Enhanced Ecommerce for subscription tracking
              gtag('config', '${googleAnalyticsId}', {
                custom_map: {
                  'subscription_type': 'custom_parameter_4',
                  'user_plan': 'custom_parameter_5'
                }
              });

              // Custom events for testing platform
              window.trackEvent = function(action, category, label, value) {
                gtag('event', action, {
                  event_category: category,
                  event_label: label,
                  value: value
                });
              };

              // Track voice command usage
              window.trackVoiceCommand = function(command, success) {
                gtag('event', 'voice_command_used', {
                  event_category: 'Voice Features',
                  event_label: command,
                  custom_parameter_2: 'voice_interaction',
                  success: success
                });
              };

              // Track test generation
              window.trackTestGeneration = function(language, testCount, duration) {
                gtag('event', 'test_generated', {
                  event_category: 'AI Features',
                  event_label: language,
                  value: testCount,
                  custom_parameter_1: 'test_generation',
                  generation_time: duration
                });
              };

              // Track security scans
              window.trackSecurityScan = function(scanType, vulnerabilitiesFound) {
                gtag('event', 'security_scan_completed', {
                  event_category: 'Security Features',
                  event_label: scanType,
                  value: vulnerabilitiesFound,
                  custom_parameter_1: 'security_testing'
                });
              };

              // Track performance tests
              window.trackPerformanceTest = function(userCount, duration, successRate) {
                gtag('event', 'performance_test_completed', {
                  event_category: 'Performance Features',
                  event_label: 'load_test',
                  value: userCount,
                  custom_parameter_1: 'performance_testing',
                  test_duration: duration,
                  success_rate: successRate
                });
              };

              // Track subscription events
              window.trackSubscription = function(action, planType, amount) {
                gtag('event', action, {
                  event_category: 'Subscription',
                  event_label: planType,
                  value: amount,
                  currency: 'USD',
                  custom_parameter_5: planType
                });
              };
            `}
          </script>
        </>
      )}

      {/* Google Search Console Verification */}
      {googleSearchConsoleId && (
        <meta name="google-site-verification" content={googleSearchConsoleId} />
      )}

      {/* Additional tracking pixels for remarketing */}
      <script>
        {`
          // Facebook Pixel (replace with actual pixel ID)
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          
          // Initialize with actual pixel ID
          // fbq('init', 'YOUR_PIXEL_ID');
          // fbq('track', 'PageView');

          // LinkedIn Insight Tag (replace with actual partner ID)
          // window._linkedin_partner_id = "YOUR_PARTNER_ID";
          // window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
          // window._linkedin_data_partner_ids.push(_linkedin_partner_id);
        `}
      </script>

      {/* Hotjar Analytics (replace with actual site ID) */}
      <script>
        {`
          // Hotjar Tracking Code (replace SITE_ID)
          // (function(h,o,t,j,a,r){
          //   h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
          //   h._hjSettings={hjid:SITE_ID,hjsv:6};
          //   a=o.getElementsByTagName('head')[0];
          //   r=o.createElement('script');r.async=1;
          //   r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
          //   a.appendChild(r);
          // })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
        `}
      </script>

      {/* Structured Data for Analytics */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": "Questro Analytics",
          "description": "Analytics tracking for voice-controlled AI testing platform",
          "provider": {
            "@type": "Organization",
            "name": "FinsavvyAI",
            "email": "info@finsavvyai.com"
          },
          "applicationCategory": "DeveloperApplication",
          "operatingSystem": "Web",
          "browserRequirements": "Requires JavaScript"
        })}
      </script>
    </Helmet>
  );
}