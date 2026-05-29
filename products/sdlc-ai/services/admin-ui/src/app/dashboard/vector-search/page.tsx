'use client'

import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Breadcrumb } from '@/components/navigation/breadcrumb'
import { useUIStore } from '@/store/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Search,
  Database,
  Clock,
  Zap,
  FileText,
  ArrowRight,
} from 'lucide-react'

const stats = {
  totalVectors: 1_284_392,
  indexSize: '2.4 GB',
  avgQueryTime: '12ms',
  queriesToday: 3_847,
}

const recentSearches = [
  { id: '1', query: 'authentication flow best practices', results: 24, time: '14ms', timestamp: '2 min ago' },
  { id: '2', query: 'rate limiting implementation', results: 18, time: '11ms', timestamp: '15 min ago' },
  { id: '3', query: 'GDPR data retention policy', results: 31, time: '9ms', timestamp: '1 hour ago' },
  { id: '4', query: 'microservice deployment strategy', results: 12, time: '16ms', timestamp: '2 hours ago' },
  { id: '5', query: 'error handling patterns', results: 42, time: '13ms', timestamp: '3 hours ago' },
]

export default function VectorSearchPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const { setBreadcrumbs } = useUIStore()

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Vector Search', active: true },
    ])
  }, [setBreadcrumbs])

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <Breadcrumb />
          <div className="mt-4">
            <h1 className="text-2xl font-bold tracking-tight">Vector Search</h1>
            <p className="text-muted-foreground">
              Search across document embeddings using semantic similarity.
            </p>
          </div>
        </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vectors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-24"
            />
            <Button size="sm" className="absolute right-1 top-1/2 -translate-y-1/2">
              <Zap className="h-4 w-4 mr-1" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vectors</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVectors.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all collections</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Index Size</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.indexSize}</div>
            <p className="text-xs text-muted-foreground">Total storage used</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Query Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgQueryTime}</div>
            <p className="text-xs text-muted-foreground">P50 latency today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queries Today</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.queriesToday.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+18% from yesterday</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>Enter a query to search across your document embeddings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-sm text-muted-foreground">
                Enter a query above to search across your document embeddings
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Results are ranked by semantic similarity
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Searches</CardTitle>
            <CardDescription>Your latest vector search queries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentSearches.map((search) => (
                <div key={search.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{search.query}</p>
                      <p className="text-xs text-muted-foreground">
                        {search.results} results in {search.time} - {search.timestamp}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0" aria-label="View search details">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </AppLayout>
  )
}
