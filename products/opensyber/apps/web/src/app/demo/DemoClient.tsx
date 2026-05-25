'use client';

import { useState, useEffect, useRef } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { EVENT_POOL, INITIAL_EVENTS, CATEGORIES_INITIAL, CONNECTIONS, DETECTION_STATS } from './demo-constants';
import type { DemoTab, LiveEvent } from './demo-constants';
import { jitter } from './demo-helpers';
import { OverviewTab } from './OverviewTab';
import { EventsTab } from './EventsTab';
import { NetworkTab } from './NetworkTab';
import { DemoBanner, DemoHeader, DemoTabs, DemoCTA } from './DemoShell';

export default function DemoClient() {
  const [tab, setTab] = useState<DemoTab>('overview');
  const [cpu, setCpu] = useState(23);
  const [mem, setMem] = useState(45);
  const [disk, setDisk] = useState(31);
  const [score, setScore] = useState(87);
  const targetScore = useRef(87);
  const [categories, setCategories] = useState(CATEGORIES_INITIAL);
  const eventId = useRef(INITIAL_EVENTS.length);
  const [events, setEvents] = useState<LiveEvent[]>(
    INITIAL_EVENTS.map((ev, i) => ({ ...ev, id: i, isNew: false })),
  );
  const [uptickSeconds, setUptickSeconds] = useState(0);
  const [lastScanned, setLastScanned] = useState(0);
  const [notifCount, setNotifCount] = useState(0);

  // No score-from-zero animation — score starts at 87 immediately

  useEffect(() => {
    function addEvent() {
      const ev = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)]!;
      const newEvent: LiveEvent = { ...ev, id: eventId.current++, time: 'Just now', isNew: true };
      setEvents((prev) => [newEvent, ...prev.slice(0, 14)]);
      setNotifCount((n) => n + 1);
      setTimeout(() => {
        setEvents((prev) => prev.map((e) => (e.id === newEvent.id ? { ...e, isNew: false } : e)));
      }, 1500);
    }
    const id = setInterval(addEvent, 3000 + Math.random() * 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setCpu((v) => Math.round(jitter(v, 12)));
      setMem((v) => Math.round(jitter(v, 8)));
      setDisk((v) => Math.round(jitter(v, 4)));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setCategories((cats) => cats.map((c) => ({ ...c, score: Math.round(jitter(c.score, 6)) })));
    }, 6000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setUptickSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setLastScanned((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      targetScore.current = Math.round(jitter(targetScore.current, 6));
      setScore(targetScore.current);
      setLastScanned(0);
    }, 8000);
    return () => clearInterval(id);
  }, []);

  const overallAvg = Math.round(categories.reduce((a, c) => a + c.score, 0) / categories.length);
  const upDays = 14;
  const upHours = Math.floor(uptickSeconds / 3600) + 6;
  const upMin = Math.floor((uptickSeconds % 3600) / 60);
  const scanText = lastScanned < 5 ? 'just now' : `${lastScanned}s ago`;

  return (
    <div className="min-h-screen bg-void text-white">
      <SiteHeader />
      <main>
      <DemoBanner notifCount={notifCount} onClearNotifs={() => setNotifCount(0)} />
      <div className="pt-24 md:pt-32 pb-12 md:pb-20">
        <div className="mx-auto max-w-6xl px-6">
          <DemoHeader upDays={upDays} upHours={upHours} upMin={upMin} lastScanned={lastScanned} scanText={scanText} />
          <DemoTabs tab={tab} setTab={setTab} notifCount={notifCount} />
          {tab === 'overview' && (
            <OverviewTab score={score} overallAvg={overallAvg} scanText={scanText}
              cpu={cpu} mem={mem} disk={disk} categories={categories}
              events={events} onViewAllEvents={() => setTab('events')} />
          )}
          {tab === 'events' && <EventsTab events={events} />}
          {tab === 'network' && <NetworkTab connections={CONNECTIONS} />}
          <DemoCTA />
        </div>
      </div>
      </main>
    </div>
  );
}
