const targets = [
  { value: 'docker-local', label: 'Docker (Local)' },
  { value: 'docker-remote', label: 'Docker (Remote)' },
  { value: 'kubernetes', label: 'Kubernetes' },
  { value: 'k3s', label: 'K3s' },
  { value: 'fly-io', label: 'Fly.io' },
  { value: 'railway', label: 'Railway' },
  { value: 'render', label: 'Render' },
  { value: 'heroku', label: 'Heroku' },
  { value: 'aws-ecs', label: 'AWS ECS' },
  { value: 'aws-lambda', label: 'AWS Lambda' },
  { value: 'gcp-cloud-run', label: 'GCP Cloud Run' },
  { value: 'gcp-gke', label: 'GCP GKE' },
  { value: 'azure-container', label: 'Azure Container Apps' },
  { value: 'digitalocean-app', label: 'DigitalOcean App Platform' },
  { value: 'hetzner', label: 'Hetzner' },
  { value: 'bare-metal', label: 'Bare Metal / SSH' },
  { value: 'terraform', label: 'Terraform' },
  { value: 'cloudformation', label: 'AWS CloudFormation' },
  { value: 'pulumi', label: 'Pulumi' },
  { value: 'ansible', label: 'Ansible' },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function DeployTargetSelect({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full max-w-sm px-3 py-2 text-sm rounded-md bg-zinc-900 border border-surface-border text-zinc-200 focus:outline-none focus:border-emerald-500"
    >
      {targets.map((t) => (
        <option key={t.value} value={t.value}>{t.label}</option>
      ))}
    </select>
  );
}
