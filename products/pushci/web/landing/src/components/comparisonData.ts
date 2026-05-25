export interface Row {
  label: string
  pushci: string
  github: string
  gitlab: string
  circle: string
}

export const rows: Row[] = [
  {
    label: 'Setup Time',
    pushci: '30 seconds',
    github: '30+ minutes',
    gitlab: '30+ minutes',
    circle: '30+ minutes',
  },
  {
    label: 'Config Files',
    pushci: 'None (AI)',
    github: 'YAML',
    gitlab: 'YAML',
    circle: 'YAML',
  },
  {
    label: 'Cost',
    pushci: 'Free',
    github: '$0.008/min',
    gitlab: '400 min/mo free',
    circle: '6,000 credits/mo',
  },
  {
    label: 'Multi-Platform',
    pushci: 'GH + GL + BB',
    github: 'GitHub only',
    gitlab: 'GitLab only',
    circle: 'GH + BB',
  },
  {
    label: 'AI-Powered',
    pushci: 'Yes',
    github: 'No',
    gitlab: 'No',
    circle: 'No',
  },
  {
    label: 'Local Runner',
    pushci: 'Built-in',
    github: 'Manual setup',
    gitlab: 'Manual setup',
    circle: 'Not available',
  },
]
