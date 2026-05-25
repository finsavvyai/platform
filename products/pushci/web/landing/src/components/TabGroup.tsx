import { useState, ReactNode } from 'react'

export interface Tab {
  id: string
  label: string
  // The sub-copy shown below the tab bar when this tab is active.
  description?: string
  content: ReactNode
}

interface TabGroupProps {
  tabs: Tab[]
  defaultTabId?: string
}

// TabGroup is a tiny zero-dependency tab switcher sized for the docs
// page. Keyboard users can tab into the buttons and use Enter/Space to
// activate. One tab is always selected — no "closed" state.
export function TabGroup({ tabs, defaultTabId }: TabGroupProps) {
  const initial = tabs.find((t) => t.id === defaultTabId) ?? tabs[0]
  const [activeId, setActiveId] = useState(initial.id)
  const active = tabs.find((t) => t.id === activeId) ?? initial

  return (
    <div>
      <div
        role="tablist"
        aria-label="Example switcher"
        className="flex flex-wrap gap-2 border-b border-border-base/60 mb-4"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              type="button"
              onClick={() => setActiveId(tab.id)}
              className={[
                'px-4 py-2 text-sm font-medium rounded-t-md transition',
                'border-b-2 -mb-px',
                isActive
                  ? 'border-accent text-t1'
                  : 'border-transparent text-t3 hover:text-t2',
              ].join(' ')}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`tabpanel-${active.id}`}
        aria-labelledby={`tab-${active.id}`}
      >
        {active.description && (
          <p className="text-sm text-t3 mb-4 leading-relaxed max-w-[70ch]">
            {active.description}
          </p>
        )}
        {active.content}
      </div>
    </div>
  )
}
