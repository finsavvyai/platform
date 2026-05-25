interface BuildBadgeProps {
  owner: string
  repo: string
  style?: 'badge' | 'minimal' | 'footer'
}

const API = 'https://api.pushci.dev'

export function BuildBadge({ owner, repo, style = 'badge' }: BuildBadgeProps) {
  const widgetUrl = `${API}/widget/${owner}/${repo}`
  const dashUrl = 'https://app.pushci.dev'

  if (style === 'minimal') {
    return (
      <a href={dashUrl} target="_blank" rel="noopener noreferrer" className="inline-block opacity-60 hover:opacity-100 transition">
        <img src={widgetUrl} alt="PushCI Build Status" height={20} />
      </a>
    )
  }

  if (style === 'footer') {
    return (
      <a href={dashUrl} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-xs text-t3 hover:text-t2 transition"
      >
        <img src={widgetUrl} alt="PushCI" height={16} />
        <span>Powered by PushCI</span>
      </a>
    )
  }

  return (
    <a href={dashUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
      <img src={widgetUrl} alt="PushCI Build Status" height={20} />
    </a>
  )
}
