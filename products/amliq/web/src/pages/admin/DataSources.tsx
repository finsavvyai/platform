import { useEffect, useState, useRef } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { api } from '../../api/client'
import { DataSourceStats } from '../../components/admin/DataSourceStats'
import { SourcesTable } from '../../components/admin/SourcesTable'
import { UploadCard, uploadFile } from '../../components/admin/UploadCard'

interface SourcesData {
  loaded: Array<{ list_id: string; count: number }>
  total_entities: number
  total_peps: number
  total_profiles: number
  available_count: number
}

interface UploadResult {
  filename: string; list_id: string; imported: number; parsed: number
}

export function DataSources() {
  const [data, setData] = useState<SourcesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null!)
  const [listId, setListId] = useState('icij_offshore')

  const fetchSources = async () => {
    try {
      const d = await api.get<SourcesData>('/admin/data-sources')
      setData(d)
    } catch { setError('Failed to load data sources') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchSources() }, [])

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true); setUploadResult(null); setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('list_id', listId)
      const resp = await uploadFile(form)
      setUploadResult(resp)
      fetchSources()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally { setUploading(false) }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try { await api.post('/admin/lists/refresh', {}); fetchSources() }
    catch { setError('Refresh failed') }
    finally { setRefreshing(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>

  return (
    <div>
      <PageHeader title="Data Sources"
        description="Manage sanctions lists, PEP databases, and custom entity sources" />
      <DataSourceStats data={data} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <div className="lg:col-span-2">
          <SourcesTable sources={data?.loaded ?? []} />
        </div>
        <div className="space-y-lg">
          <UploadCard fileRef={fileRef} listId={listId} setListId={setListId}
            uploading={uploading} onUpload={handleUpload} result={uploadResult} />
          <Card>
            <h3 className="sf-headline mb-md">Sync Lists</h3>
            <p className="sf-caption mb-lg" style={{ color: 'var(--dash-text-secondary)' }}>
              Re-download all sanctions lists from official sources
            </p>
            <Button onClick={handleRefresh} disabled={refreshing} className="w-full">
              {refreshing ? 'Syncing...' : 'Sync All Lists'}
            </Button>
          </Card>
        </div>
      </div>
      {error && (
        <Card className="mt-lg"><p className="text-red-500 sf-body">{error}</p></Card>
      )}
    </div>
  )
}

export default DataSources
