interface DashboardGreetingProps {
  firstName: string | null;
}

export function DashboardGreeting({ firstName }: DashboardGreetingProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = firstName || 'there';
  const date = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {greeting}, {name}
      </h1>
      <p className="text-sm text-neutral-400 mt-1">{date}</p>
    </div>
  );
}
