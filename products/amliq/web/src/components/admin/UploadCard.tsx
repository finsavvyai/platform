import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { tokenManager } from '../../utils/tokenManager'

interface UploadResult {
  filename: string; list_id: string; imported: number; parsed: number
}

interface UploadCardProps {
  fileRef: React.RefObject<HTMLInputElement>
  listId: string
  setListId: (v: string) => void
  uploading: boolean
  onUpload: () => void
  result: UploadResult | null
}

export function UploadCard({ fileRef, listId, setListId, uploading, onUpload, result }: UploadCardProps) {
  return (
    <Card>
      <h3 className="sf-headline mb-md">Upload CSV</h3>
      <p className="sf-caption mb-lg" style={{ color: 'var(--dash-text-secondary)' }}>
        Import ICIJ, custom lists, or any CSV with entity names
      </p>
      <input ref={fileRef} type="file" accept=".csv"
        className="w-full mb-md text-sm file:mr-4 file:py-2 file:px-4
          file:rounded-apple file:border-0 file:bg-[#C9A96E]/20 file:text-[#C9A96E]
          file:font-semibold file:cursor-pointer" />
      <input type="text" value={listId} onChange={e => setListId(e.target.value)}
        placeholder="List ID (e.g. icij_offshore)" className="input-field w-full mb-md" />
      <Button onClick={onUpload} disabled={uploading} className="w-full">
        {uploading ? 'Uploading...' : 'Upload & Import'}
      </Button>
      {result && (
        <div className="mt-md p-md rounded-apple-md bg-emerald-500/10">
          <p className="sf-caption text-emerald-500">
            Imported {result.imported.toLocaleString()} entities from {result.filename}
          </p>
        </div>
      )}
    </Card>
  )
}

export async function uploadFile(form: FormData): Promise<UploadResult> {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'
  const resp = await fetch(`${API_BASE}/api/v1/admin/data-sources/upload`, {
    method: 'POST',
    headers: tokenManager.getAuthHeader(),
    body: form,
  })
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.message || 'Upload failed')
  }
  const json = await resp.json()
  return json.data ?? json
}
