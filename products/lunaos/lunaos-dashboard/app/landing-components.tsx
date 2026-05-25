'use client';

import { useEffect, useRef, useState } from 'react';

export function CursorTracker() {
    const eyeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleMouseMove(e: MouseEvent) {
            if (!eyeRef.current) return;
            const rect = eyeRef.current.getBoundingClientRect();
            const eyeX = rect.left + rect.width / 2;
            const eyeY = rect.top + rect.height / 2;
            const angle = Math.atan2(e.clientY - eyeY, e.clientX - eyeX);
            const distance = Math.min(8, Math.hypot(e.clientX - eyeX, e.clientY - eyeY) * 0.025);
            const pupilX = Math.cos(angle) * distance;
            const pupilY = Math.sin(angle) * distance;
            const pupil = eyeRef.current.querySelector('.pupil') as HTMLElement;
            if (pupil) {
                pupil.style.transform = `translate(${pupilX}px, ${pupilY}px)`;
            }
        }
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div ref={eyeRef} className="relative inline-block">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.4)]">
                <div className="pupil w-6 h-10 bg-neutral-950 rounded-full transition-transform duration-100 ease-out flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white/30 rounded-full -mt-2 -ml-1" />
                </div>
            </div>
        </div>
    );
}

export function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        const duration = 1500;
        const start = performance.now();
        function update(now: number) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }, [target]);

    return <>{count}{suffix}</>;
}

export const features = [
    {
        icon: '🔍',
        title: 'Code Review',
        description: 'AI-powered review that catches bugs, suggests improvements, and enforces best practices.',
    },
    {
        icon: '🧪',
        title: 'Test Generation',
        description: 'Automatically generate unit tests, integration tests, and edge case coverage.',
    },
    {
        icon: '🔒',
        title: 'Security Audit',
        description: 'Comprehensive security analysis: vulnerabilities, dependencies, and compliance.',
    },
    {
        icon: '📋',
        title: 'Sprint Planning',
        description: 'Turn requirements into actionable sprint plans with time estimates.',
    },
    {
        icon: '📝',
        title: 'Documentation',
        description: 'Generate API docs, READMEs, and inline documentation from your codebase.',
    },
    {
        icon: '🚀',
        title: 'CI/CD Pipeline',
        description: 'Generate deployment configs, Dockerfiles, and pipeline definitions.',
    },
];

export const stats = [
    { value: 28, label: 'AI Agents', suffix: '' },
    { value: 7, label: 'Categories', suffix: '' },
    { value: 12, label: 'LLM Providers', suffix: '' },
    { value: 100, label: 'Free Runs/mo', suffix: '' },
];
