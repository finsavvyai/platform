import React from 'react'

export const HomePage: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="text-center py-16">
        <h1 className="text-5xl font-bold mb-6">
          SDLC.ai Developer Portal
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Zero-trust RAG, LLM gateway, and compliance layer
          for enterprises to safely deploy AI at scale.
        </p>
      </div>
    </div>
  )
}
