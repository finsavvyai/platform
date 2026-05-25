import { notFound } from 'next/navigation'
import { allDocs } from 'contentlayer/generated'
import type { Doc } from 'contentlayer/generated'

import { DocPage } from '@/components/doc-page'
import { Sidebar } from '@/components/sidebar'
import { TableOfContents } from '@/components/table-of-contents'

interface DocPageProps {
  params: {
    slug: string[]
  }
}

async function getDocFromParams(params: DocPageProps['params']) {
  const slug = params.slug?.join('/')
  const doc = allDocs.find((doc) => doc.slugAsParams === slug)

  if (!doc) {
    null
  }

  return doc
}

export async function generateMetadata({ params }: DocPageProps) {
  const doc = await getDocFromParams(params)

  if (!doc) {
    return {}
  }

  return {
    title: doc.title,
    description: doc.description,
    keywords: doc.tags?.join(', '),
  }
}

export async function generateStaticParams(): Promise<DocPageProps['params'][]> {
  return allDocs.map((doc) => ({
    slug: doc.slugAsParams.split('/'),
  }))
}

export default async function DocPageComponent({ params }: DocPageProps) {
  const doc = await getDocFromParams(params)

  if (!doc) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <Sidebar currentDoc={doc} />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="max-w-4xl">
              <DocPage doc={doc} />
            </div>
          </div>

          {/* Table of Contents */}
          <div className="hidden xl:block w-64 flex-shrink-0">
            <TableOfContents doc={doc} />
          </div>
        </div>
      </div>
    </div>
  )
}