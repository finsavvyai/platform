import { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { SearchField } from '../components/ui/SearchField'
import { ScreeningQuotaBanner } from '../components/screening/ScreeningQuotaBanner'
import { api, ApiError } from '../api/client'
import { VesselForm } from '../components/screening/VesselForm'
import { VesselResults } from '../components/screening/VesselResults'
import { LimitReachedBanner } from '../components/screening/LimitReachedBanner'

interface VesselScreenResponse {
  matches: Array<{
    match_id: string; vessel_name: string; list_source: string;
    confidence: number; rule_id: string; explanation: string;
    vessel_details: Record<string, unknown>;
  }>
  total: number
}

export function VesselScreening() {
  const [vesselName, setVesselName] = useState('')
  const [imo, setIMO] = useState('')
  const [mmsi, setMMSI] = useState('')
  const [flag, setFlag] = useState('')
  const [results, setResults] = useState<VesselScreenResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const isLimitError = error instanceof ApiError && error.status === 402

  const handleScreen = async () => {
    if (!vesselName.trim()) return
    setLoading(true); setError(null); setResults(null)
    try {
      const data = await api.post<VesselScreenResponse>('/vessel/screen', {
        vessel_name: vesselName.trim(),
        imo: imo.trim() || undefined,
        mmsi: mmsi.trim() || undefined,
        flag: flag || undefined,
      })
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally { setLoading(false) }
  }

  return (
    <div>
      <PageHeader title="Vessel Screening"
        description="Screen maritime vessels against global sanctions and restricted vessel lists" />
      <div className="mb-lg"><ScreeningQuotaBanner /></div>
      <Card className="mb-lg">
        <VesselForm vesselName={vesselName} setVesselName={setVesselName}
          imo={imo} setIMO={setIMO} mmsi={mmsi} setMMSI={setMMSI}
          flag={flag} setFlag={setFlag} onSubmit={handleScreen} />
        <Button onClick={handleScreen} disabled={loading || !vesselName.trim()}
          className="w-full mt-md">
          {loading ? 'Screening...' : 'Screen Vessel'}
        </Button>
      </Card>
      {error && isLimitError && <LimitReachedBanner error={error} />}
      {error && !isLimitError && (
        <Card className="mb-lg">
          <p role="alert" className="text-red-500 sf-body">{error.message}</p>
        </Card>
      )}
      {loading && (
        <Card className="mb-lg text-center">
          <p className="sf-body">Screening vessel "{vesselName}"...</p>
        </Card>
      )}
      {!loading && results && !isLimitError && (
        <VesselResults results={results} vesselName={vesselName} />
      )}
    </div>
  )
}
