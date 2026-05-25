import {
  HomeIcon,
  CogIcon,
  DocumentTextIcon,
  PlayIcon,
  CreditCardIcon,
  VideoCameraIcon,
  ChartBarIcon,
  EyeIcon,
  BeakerIcon,
  CpuChipIcon,
  CloudIcon,
  CommandLineIcon,
  RocketLaunchIcon,
  WrenchScrewdriverIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

export const phaseOneNavigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: HomeIcon,
  },
  {
    name: 'Test Cases',
    href: '/cases',
    icon: DocumentTextIcon,
  },
  {
    name: 'Test Runs',
    href: '/runs',
    icon: PlayIcon,
  },
  {
    name: 'Test Plans',
    href: '/plans',
    icon: BeakerIcon,
  },
  {
    name: 'Test Gen',
    href: '/test-gen',
    icon: SparklesIcon,
  },
  {
    name: 'AI Center',
    href: '/ai-center',
    icon: CpuChipIcon,
  },
  {
    name: 'Analytics',
    href: '/insights',
    icon: ChartBarIcon,
  },
  {
    name: 'Visual Regression',
    href: '/visual-regression',
    icon: EyeIcon,
  },
  {
    name: 'Recording Studio',
    href: '/recording-studio',
    icon: VideoCameraIcon,
  },
  {
    name: 'AI Recorder',
    href: '/ai-recorder',
    icon: ChatBubbleLeftRightIcon,
  },
  {
    name: 'Explorations',
    href: '/explorations',
    icon: BeakerIcon,
  },
  {
    name: 'API Studio',
    href: '/api-studio',
    icon: CommandLineIcon,
  },
  {
    name: 'Cloud Devices',
    href: '/cloud-devices',
    icon: CloudIcon,
  },
  {
    name: 'Mission Control',
    href: '/mission-control',
    icon: RocketLaunchIcon,
  },
  {
    name: 'Service Virtualization',
    href: '/service-virtualization',
    icon: WrenchScrewdriverIcon,
  },
  {
    name: 'Agents',
    href: '/agents',
    icon: BoltIcon,
  },
  {
    name: 'Automations',
    href: '/automation-runs',
    icon: CogIcon,
  },
  {
    name: 'Stories',
    href: '/stories',
    icon: DocumentTextIcon,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: CogIcon,
  },
  {
    name: 'Billing',
    href: '/billing',
    icon: CreditCardIcon,
  },
] as const;
