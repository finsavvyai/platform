interface Props {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, description, action }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-zinc-100">{title}</h1>
        {description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}
