'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { githubApi, type GitHubStatus, type GitHubRepo, type IndexedRepo } from '@/lib/api';
import { OAUTH_ERROR_MESSAGES } from './repos-constants';
import type { ToastData } from './toast-notification';

export interface IndexResult {
    repo: string;
    files: number;
    time: number;
}

export function useReposData() {
    const searchParams = useSearchParams();
    const [ghStatus, setGhStatus] = useState<GitHubStatus | null>(null);
    const [repos, setRepos] = useState<GitHubRepo[]>([]);
    const [indexedRepos, setIndexedRepos] = useState<IndexedRepo[]>([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [indexingRepo, setIndexingRepo] = useState<string | null>(null);
    const [indexResult, setIndexResult] = useState<IndexResult | null>(null);
    const [disconnecting, setDisconnecting] = useState(false);
    const [search, setSearch] = useState('');
    const [toast, setToast] = useState<ToastData | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const status = await githubApi.status();
            setGhStatus(status);

            if (status.connected) {
                const [repoData, indexedData] = await Promise.all([
                    githubApi.repos().catch(() => ({ repos: [], page: 1, perPage: 30, total: 0 })),
                    githubApi.indexed().catch(() => ({ repos: [] })),
                ]);
                setRepos(repoData.repos || []);
                setIndexedRepos(indexedData.repos || []);
            }
        } catch {
            // Data load failed silently
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        const connected = searchParams.get('connected');
        const username = searchParams.get('username');
        const error = searchParams.get('error');

        if (connected === 'true' && username) {
            setToast({ type: 'success', message: `Connected to GitHub as @${username}` });
            loadData();
        } else if (error) {
            setToast({
                type: 'error',
                message: OAUTH_ERROR_MESSAGES[error] || `OAuth error: ${error}`,
            });
        }
    }, [searchParams, loadData]);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    async function handleConnect() {
        setConnecting(true);
        try {
            const { url } = await githubApi.getAuthUrl();
            window.location.href = url;
        } catch {
            setToast({ type: 'error', message: 'Failed to initiate GitHub OAuth' });
            setConnecting(false);
        }
    }

    async function handleDisconnect() {
        const confirmed = confirm(
            'Disconnect GitHub? Your indexed repos will remain but you won\'t be able to re-index until you reconnect.'
        );
        if (!confirmed) return;

        setDisconnecting(true);
        try {
            await githubApi.disconnect();
            setGhStatus({ connected: false });
            setRepos([]);
            setToast({ type: 'success', message: 'GitHub disconnected' });
        } catch {
            setToast({ type: 'error', message: 'Failed to disconnect GitHub' });
        } finally {
            setDisconnecting(false);
        }
    }

    async function handleIndex(fullName: string) {
        const [owner, repo] = fullName.split('/');
        setIndexingRepo(fullName);
        setIndexResult(null);
        try {
            const result = await githubApi.indexRepo(owner, repo);
            setIndexResult({
                repo: fullName,
                files: result.indexedFiles,
                time: result.processingTime,
            });
            setToast({ type: 'success', message: `Indexed ${result.indexedFiles} files from ${fullName}` });
            const updated = await githubApi.indexed().catch(() => ({ repos: [] }));
            setIndexedRepos(updated.repos || []);
            setRepos(prev => prev.map(r =>
                r.fullName === fullName ? { ...r, indexed: true } : r
            ));
        } catch {
            setToast({ type: 'error', message: `Failed to index ${fullName}` });
        } finally {
            setIndexingRepo(null);
        }
    }

    const filteredRepos = repos.filter(r =>
        search === '' ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.fullName.toLowerCase().includes(search.toLowerCase()) ||
        (r.language || '').toLowerCase().includes(search.toLowerCase())
    );

    return {
        ghStatus,
        filteredRepos,
        indexedRepos,
        loading,
        connecting,
        indexingRepo,
        indexResult,
        disconnecting,
        search,
        toast,
        setSearch,
        setToast,
        setIndexResult,
        handleConnect,
        handleDisconnect,
        handleIndex,
    };
}
