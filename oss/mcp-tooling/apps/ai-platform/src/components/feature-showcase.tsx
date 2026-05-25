'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@mcpoverflow/ui'

interface Feature {
  icon: any
  title: string
  description: string
  color: string
}

interface FeatureShowcaseProps {
  features: Feature[]
}

export function FeatureShowcase({ features }: FeatureShowcaseProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const nextFeature = () => {
    setActiveIndex((prev) => (prev + 1) % features.length)
  }

  const prevFeature = () => {
    setActiveIndex((prev) => (prev - 1 + features.length) % features.length)
  }

  const ActiveIcon = features[activeIndex].icon

  return (
    <div className="relative">
      {/* Main feature display */}
      <div className="grid md:grid-cols-2 gap-12 items-center mb-8">
        <div className="space-y-6">
          <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${features[activeIndex].color} w-fit`}>
            <ActiveIcon className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-3xl md:text-4xl font-bold text-white">
            {features[activeIndex].title}
          </h3>
          <p className="text-lg text-purple-100 leading-relaxed">
            {features[activeIndex].description}
          </p>
          <Button className="bg-purple-600 hover:bg-purple-700 text-white">
            Learn More <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="relative">
          <div className="glass-effect rounded-2xl p-8 border border-purple-500/30">
            <div className="aspect-square bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center">
              <div className="text-center">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-16 h-16 rounded-lg bg-gradient-to-br ${features[activeIndex].color} opacity-${Math.max(0.2, 1 - i * 0.1)
                        }`}
                    />
                  ))}
                </div>
                <p className="text-purple-200 text-sm">
                  Interactive visualization
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature indicators */}
      <div className="flex items-center justify-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={prevFeature}
          className="text-purple-300 hover:text-white hover:bg-purple-800/20"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex space-x-2">
          {features.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${index === activeIndex
                  ? 'bg-purple-400 w-8'
                  : 'bg-purple-600/50 hover:bg-purple-600/70'
                }`}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={nextFeature}
          className="text-purple-300 hover:text-white hover:bg-purple-800/20"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Feature grid for smaller screens */}
      <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature, index) => {
          const FeatureIcon = feature.icon
          return (
            <div
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`glass-effect rounded-xl p-6 border cursor-pointer transition-all hover:scale-105 ${index === activeIndex
                  ? 'border-purple-400 bg-purple-500/20'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
            >
              <div className={`inline-flex p-2 rounded-lg bg-gradient-to-r ${feature.color} w-fit mb-4`}>
                <FeatureIcon className="h-6 w-6 text-white" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h4>
              <p className="text-sm text-purple-200 line-clamp-2">
                {feature.description}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}