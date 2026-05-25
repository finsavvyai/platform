import { useTranslation } from 'react-i18next'
import { Zap, LayoutDashboard, Code, Code2, FileText } from 'lucide-react'
import clsx from 'clsx'
import { ProductType } from '../../types/billing'

interface ProductTabsProps {
  activeProduct: ProductType
  onChange: (product: ProductType) => void
}

const productIcons: Record<ProductType, React.ReactNode> = {
  api: <Zap className="w-4 h-4" />,
  dashboard: <LayoutDashboard className="w-4 h-4" />,
  sdk: <Code className="w-4 h-4" />,
  iframe: <Code2 className="w-4 h-4" />,
  dataset: <FileText className="w-4 h-4" />,
}

const productIds: ProductType[] = ['api', 'dashboard', 'sdk', 'iframe', 'dataset']

export function ProductTabs({ activeProduct, onChange }: ProductTabsProps) {
  const { t } = useTranslation('marketing')

  return (
    <div className="flex overflow-x-auto gap-1 px-4 py-3 bg-white/50 rounded-xl border border-slate-200">
      {productIds.map(id => (
        <button
          type="button"
          key={id}
          onClick={() => onChange(id)}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all text-sm min-h-[44px]',
            activeProduct === id
              ? 'font-semibold'
              : 'text-slate-600 hover:bg-white/5'
          )}
          style={activeProduct === id ? { background: 'var(--bg-elevated)', color: 'var(--text)' } : undefined}
        >
          {productIcons[id]}
          <span className="hidden sm:inline">{t(`products.${id}`)}</span>
        </button>
      ))}
    </div>
  )
}
