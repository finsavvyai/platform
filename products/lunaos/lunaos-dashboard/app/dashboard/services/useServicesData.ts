'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    servicesApi,
    type ServicesCatalog,
    type ServiceHealth,
} from '../../../lib/api';

export interface TestResult {
    healthy: boolean;
    latency: string;
}

export function useServicesData() {
    const [catalog, setCatalog] = useState<ServicesCatalog | null>(null);
    const [health, setHealth] = useState<ServiceHealth | null>(null);
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, TestResult>>(
        {},
    );

    const fetchData = useCallback(async () => {
        try {
            const [catalogData, healthData] = await Promise.all([
                servicesApi.catalog().catch(() => null),
                servicesApi.health().catch(() => null),
            ]);
            if (catalogData) setCatalog(catalogData);
            if (healthData) setHealth(healthData);
        } catch (err) {
            // Error loading services - will display empty state
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleTest = async (serviceId: string) => {
        setTesting(serviceId);
        try {
            const result = await servicesApi.test(serviceId);
            setTestResults((prev) => ({
                ...prev,
                [serviceId]: {
                    healthy: result.healthy,
                    latency: result.totalLatency,
                },
            }));
        } catch {
            setTestResults((prev) => ({
                ...prev,
                [serviceId]: { healthy: false, latency: 'error' },
            }));
        } finally {
            setTesting(null);
        }
    };

    return { catalog, health, loading, testing, testResults, handleTest };
}
