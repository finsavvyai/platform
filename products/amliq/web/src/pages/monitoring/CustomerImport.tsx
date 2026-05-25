import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Upload, AlertCircle, CheckCircle } from 'lucide-react'
import Papa from 'papaparse'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { api } from '../../api/client'

const REQUIRED_COLUMNS = ['external_id', 'entity_type', 'name'] as const
const OPTIONAL_COLUMNS = [
  'first_name', 'last_name', 'date_of_birth', 'nationality',
  'country_of_residence', 'identifier_type', 'identifier_value',
]

const TEMPLATE_CSV =
  'external_id,entity_type,name,first_name,last_name,date_of_birth,nationality,country_of_residence,identifier_type,identifier_value\n' +
  'cust_001,individual,Jane Doe,Jane,Doe,1985-04-12,US,US,passport,X12345678\n' +
  'cust_002,company,Acme Trading LLC,,,,,AE,reg_number,LLC-4521\n' +
  'cust_003,individual,John Smith,John,Smith,1972-11-03,GB,GB,national_id,YZ987654\n'

const MAX_ROWS = 100_000

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: true,
    header: false,
    preview: MAX_ROWS + 1, // +1 to include header row
  })
  if (!result.data.length) return { headers: [], rows: [] }
  const [headerRow, ...dataRows] = result.data as string[][]
  const headers = headerRow.map(h => h.trim())
  const rows = dataRows.slice(0, 5).map(r => r.map(c => c.trim()))
  return { headers, rows }
}

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'amliq-customer-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function CustomerImport() {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [parseError, setParseError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState<{ imported: number; skipped: number } | null>(null)

  const handleFile = async (f: File) => {
    setParseError('')
    setDone(null)
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a .csv file.')
      return
    }
    setFile(f)
    const text = await f.text()
    const parsed = parseCsv(text)
    const missing = REQUIRED_COLUMNS.filter(c => !parsed.headers.includes(c))
    if (missing.length) {
      setParseError(`Missing required columns: ${missing.join(', ')}`)
      setPreview(null)
      return
    }
    setPreview(parsed)
  }

  const submit = async () => {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const json = await api.upload<{ imported: number; skipped: number }>(
        '/ingest/customers/import',
        fd,
      )
      setDone({ imported: json.imported ?? 0, skipped: json.skipped ?? 0 })
    } catch {
      setParseError('Upload failed — check your network and try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate('/monitoring')}
        className="inline-flex items-center gap-xs text-sm mb-md opacity-70 hover:opacity-100 cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Back to monitoring
      </button>
      <PageHeader title="Import customer base" description="Bulk-onboard your customer list into ongoing monitoring. Upload a CSV with one row per customer and we’ll screen every entry against sanctions, PEP, and adverse-media lists." />

      <Card className="mb-lg">
        <h3 className="sf-headline mb-sm">1. Download the template</h3>
        <p className="sf-caption mb-md">
          Required columns: <code>external_id</code>, <code>entity_type</code> (<code>individual</code> or <code>company</code>), <code>name</code>.
          Optional: {OPTIONAL_COLUMNS.map(c => <code key={c} className="mx-0.5">{c}</code>)}.
        </p>
        <Button variant="secondary" onClick={downloadTemplate} className="inline-flex items-center gap-sm">
          <Download className="w-4 h-4" /> Download template.csv
        </Button>
      </Card>

      <Card className="mb-lg">
        <h3 className="sf-headline mb-sm">2. Upload your CSV</h3>
        <label className="block border-2 border-dashed rounded-apple-md p-xl text-center cursor-pointer transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-surface)' }}>
          <Upload className="w-6 h-6 mx-auto mb-sm" style={{ color: 'var(--dash-text-tertiary)' }} />
          <p className="sf-body mb-xs" style={{ color: 'var(--dash-text)' }}>
            {file ? file.name : 'Click to choose a CSV file'}
          </p>
          <p className="text-xs" style={{ color: 'var(--dash-text-tertiary)' }}>
            Up to 100,000 rows per upload.
          </p>
          <input type="file" accept=".csv,text/csv" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
      </Card>

      {parseError && (
        <Card className="mb-lg" style={{ borderColor: 'rgba(192,57,43,0.25)' }}>
          <div className="flex items-start gap-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#C0392B' }} />
            <p role="alert" className="text-sm" style={{ color: '#C0392B' }}>{parseError}</p>
          </div>
        </Card>
      )}

      {preview && !done && (
        <Card className="mb-lg">
          <h3 className="sf-headline mb-sm">3. Preview — first 5 rows</h3>
          <div className="overflow-x-auto mb-md">
            <table className="w-full text-xs">
              <thead>
                <tr>{preview.headers.map(h => (
                  <th key={h} className="text-left px-sm py-xs font-semibold"
                    style={{ color: 'var(--dash-text-secondary)', borderBottom: '1px solid var(--dash-border)' }}>
                    {h}
                  </th>
                ))}</tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => (
                    <td key={j} className="px-sm py-xs" style={{ color: 'var(--dash-text)' }}>{c || '—'}</td>
                  ))}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={submit} disabled={uploading} className="w-full">
            {uploading ? 'Uploading…' : 'Import and start monitoring'}
          </Button>
        </Card>
      )}

      {done && (
        <Card className="mb-lg" style={{ borderColor: 'rgba(52,199,89,0.25)' }}>
          <div className="flex items-start gap-sm">
            <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#34C759' }} />
            <div>
              <p className="font-medium mb-xs" style={{ color: 'var(--dash-text)' }}>
                Import complete — {done.imported} customers now under monitoring
              </p>
              {done.skipped > 0 && (
                <p className="text-xs" style={{ color: 'var(--dash-text-secondary)' }}>
                  {done.skipped} rows were skipped (duplicates or invalid data).
                </p>
              )}
              <Button variant="secondary" size="sm" className="mt-sm" onClick={() => navigate('/monitoring')}>
                Back to monitoring
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
