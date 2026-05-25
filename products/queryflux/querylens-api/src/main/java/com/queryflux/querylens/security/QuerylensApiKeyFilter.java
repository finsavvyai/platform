package com.queryflux.querylens.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * When {@code querylens.api-key} is set, requires matching {@code X-QueryLens-Api-Key} on /api/* except GET *\/health.
 */
public class QuerylensApiKeyFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-QueryLens-Api-Key";

    private final String expectedKey;

    public QuerylensApiKeyFilter(String expectedKey) {
        this.expectedKey = expectedKey;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        if (expectedKey.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }
        if ("GET".equalsIgnoreCase(request.getMethod()) && request.getRequestURI().endsWith("/health")) {
            filterChain.doFilter(request, response);
            return;
        }
        String provided = request.getHeader(HEADER);
        if (!expectedKey.equals(provided)) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid or missing API key");
            return;
        }
        filterChain.doFilter(request, response);
    }
}
