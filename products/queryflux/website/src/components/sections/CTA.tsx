"use client";

import { motion } from "framer-motion";
import { ArrowRight, Download, Star } from "lucide-react";
// import { Button } from '@/components/ui/Button'

export function CTA() {
  return (
    <section className="py-20 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium mb-8">
            <Star className="w-4 h-4 mr-2 fill-current text-yellow-400" />
            Join 50,000+ professionals already using QueryFlux
          </div>

          {/* Main Heading */}
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Ready to Transform Your
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Database Workflow?
            </span>
          </h2>

          {/* Subheading */}
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Get started with our free plan and experience the power of
            AI-assisted database management. No credit card required, upgrade
            anytime.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button className="inline-flex items-center justify-center px-8 py-4 text-lg bg-white text-gray-900 rounded-xl hover:bg-gray-100 font-semibold transition-all duration-200">
              <Download className="w-5 h-5 mr-2" />
              Download Free Version
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
            <button className="inline-flex items-center justify-center px-8 py-4 text-lg border-2 border-white text-white rounded-xl hover:bg-white hover:text-gray-900 font-semibold transition-all duration-200">
              Schedule Demo
            </button>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-400">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              No credit card required
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Setup in 2 minutes
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Cancel anytime
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              30-day guarantee
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
