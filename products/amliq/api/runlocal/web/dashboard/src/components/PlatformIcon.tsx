import { Platform } from '../data/types';

const icons: Record<Platform, { label: string; color: string }> = {
  github: { label: 'GH', color: 'bg-zinc-700' },
  gitlab: { label: 'GL', color: 'bg-orange-700' },
  bitbucket: { label: 'BB', color: 'bg-blue-700' },
};

interface Props {
  platform: Platform;
}

export default function PlatformIcon({ platform }: Props) {
  const { label, color } = icons[platform];
  return (
    <div className={`w-8 h-8 rounded-md ${color} flex items-center justify-center text-xs font-bold text-white`}>
      {label}
    </div>
  );
}
