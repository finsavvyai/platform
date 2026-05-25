package com.queryflux.querylens.config;

import com.queryflux.querylens.security.QuerylensApiKeyFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

/**
 * Optional API key gate for production ({@code QUERYLENS_API_KEY}). Health endpoints stay public.
 */
@Configuration
public class QuerylensApiKeyFilterConfig {

    @Bean
    public FilterRegistrationBean<QuerylensApiKeyFilter> querylensApiKeyFilter(
            @Value("${querylens.api-key:}") String apiKey) {
        FilterRegistrationBean<QuerylensApiKeyFilter> reg = new FilterRegistrationBean<>();
        reg.setFilter(new QuerylensApiKeyFilter(apiKey == null ? "" : apiKey));
        reg.addUrlPatterns("/api/*");
        reg.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return reg;
    }
}
