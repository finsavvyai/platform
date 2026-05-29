'use client'

import { useEffect } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Breadcrumb } from '@/components/navigation/breadcrumb'
import { useUIStore } from '@/store/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Upload,
  File,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
} from 'lucide-react'

const documents = [
  { id: '1', name: 'Security Policy v3.2.pdf', type: 'PDF', size: '2.4 MB', status: 'Indexed', uploaded: '2026-03-01' },
  { id: '2', name: 'API Reference Guide.docx', type: 'DOCX', size: '1.8 MB', status: 'Indexed', uploaded: '2026-03-03' },
  { id: '3', name: 'Compliance Checklist.pdf', type: 'PDF', size: '892 KB', status: 'Processing', uploaded: '2026-03-05' },
  { id: '4', name: 'Onboarding Notes.txt', type: 'TXT', size: '45 KB', status: 'Indexed', uploaded: '2026-02-28' },
  { id: '5', name: 'Architecture Overview.pdf', type: 'PDF', size: '5.1 MB', status: 'Failed', uploaded: '2026-03-06' },
  { id: '6', name: 'Release Notes Q1.docx', type: 'DOCX', size: '310 KB', status: 'Processing', uploaded: '2026-03-07' },
]

const stats = { total: 847, processing: 12, indexed: 823, failed: 12 }

function getTypeBadge(type: string) {
  const variant = type === 'PDF' ? 'default' : type === 'DOCX' ? 'secondary' : 'outline'
  return <Badge variant={variant}>{type}</Badge>
}

function getStatusBadge(status: string) {
  if (status === 'Indexed') return <Badge variant="success">{status}</Badge>
  if (status === 'Processing') return <Badge variant="secondary">{status}</Badge>
  return <Badge variant="destructive">{status}</Badge>
}

function getStatusIcon(status: string) {
  if (status === 'Indexed') return <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
  if (status === 'Processing') return <Clock className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
  return <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
}

export default function DocumentsPage() {
  const { setBreadcrumbs } = useUIStore()

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Documents', active: true },
    ])
  }, [setBreadcrumbs])

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <Breadcrumb />
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
              <p className="text-muted-foreground">
                Upload, manage, and track document processing for your knowledge base.
              </p>
            </div>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
        </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all collections</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.processing}</div>
            <p className="text-xs text-muted-foreground">Currently in pipeline</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indexed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.indexed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Ready for search</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failed}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Library</CardTitle>
          <CardDescription>All uploaded documents and their processing status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <File className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.size} - {doc.uploaded}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getTypeBadge(doc.type)}
                  {getStatusBadge(doc.status)}
                  {getStatusIcon(doc.status)}
                  <Button variant="ghost" size="sm" aria-label="Delete document">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>
    </AppLayout>
  )
}
