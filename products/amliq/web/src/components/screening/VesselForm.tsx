import { SearchField } from '../ui/SearchField'

const FLAG_COUNTRIES: Record<string, string> = {
  PA: 'Panama', LR: 'Liberia', SG: 'Singapore', MT: 'Malta',
  BS: 'Bahamas', CN: 'China', PH: 'Philippines', JP: 'Japan',
  DE: 'Germany', NL: 'Netherlands', GB: 'United Kingdom',
  KR: 'South Korea', NO: 'Norway', DK: 'Denmark',
}

interface VesselFormProps {
  vesselName: string; setVesselName: (v: string) => void
  imo: string; setIMO: (v: string) => void
  mmsi: string; setMMSI: (v: string) => void
  flag: string; setFlag: (v: string) => void
  onSubmit: () => void
}

export function VesselForm({
  vesselName, setVesselName, imo, setIMO, mmsi, setMMSI, flag, setFlag, onSubmit,
}: VesselFormProps) {
  return (
    <div className="space-y-md">
      <div>
        <label className="sf-caption font-medium block mb-sm">Vessel Name</label>
        <SearchField placeholder="e.g., EVER GIVEN, MSC GULSUN"
          value={vesselName} onChange={setVesselName} onSubmit={onSubmit} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
        <div>
          <label className="sf-caption font-medium block mb-sm">IMO Number</label>
          <input type="text" placeholder="e.g., 9811000" value={imo}
            onChange={e => setIMO(e.target.value)} className="input-field w-full" />
        </div>
        <div>
          <label className="sf-caption font-medium block mb-sm">MMSI</label>
          <input type="text" placeholder="e.g., 636090000" value={mmsi}
            onChange={e => setMMSI(e.target.value)} className="input-field w-full" />
        </div>
        <div>
          <label className="sf-caption font-medium block mb-sm">Flag State</label>
          <select value={flag} onChange={e => setFlag(e.target.value)}
            className="input-field w-full">
            <option value="">Select flag...</option>
            {Object.entries(FLAG_COUNTRIES).map(([code, name]) => (
              <option key={code} value={code}>{name} ({code})</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
