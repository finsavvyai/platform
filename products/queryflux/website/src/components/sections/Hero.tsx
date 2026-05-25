"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Download,
  Play,
  Star,
  Zap,
  Database,
  Shield,
  Users,
} from "lucide-react";
// import { Button } from '@/components/ui/Button'

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white pt-16">
      {/* Background Pattern */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Ccircle cx='7' cy='7' r='7'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      ></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-black text-white mb-8"
          >
            <Star className="w-4 h-4 mr-2 fill-current" />
            4.8/5 rating from 1,250+ reviews
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight"
          >
            The Future of
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Database Management
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl sm:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed"
          >
            AI-powered query optimization, real-time collaboration, and support
            for 35+ database types. Built for developers, data analysts, and
            database administrators.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
          >
            <button className="inline-flex items-center justify-center px-8 py-4 text-lg bg-black text-white rounded-xl hover:bg-gray-800 font-semibold transition-all duration-200">
              <Download className="w-5 h-5 mr-2" />
              Download Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
            <button className="inline-flex items-center justify-center px-8 py-4 text-lg border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-all duration-200">
              <Play className="w-5 h-5 mr-2" />
              Watch Demo
            </button>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-600"
          >
            <div className="flex items-center">
              <Database className="w-5 h-5 mr-2 text-green-600" />
              35+ Database Types
            </div>
            <div className="flex items-center">
              <Zap className="w-5 h-5 mr-2 text-yellow-600" />
              AI-Powered
            </div>
            <div className="flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-600" />
              Real-time Collaboration
            </div>
            <div className="flex items-center">
              <Shield className="w-5 h-5 mr-2 text-red-600" />
              Enterprise Security
            </div>
          </motion.div>
        </div>

        {/* Hero Image/Visual */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-16 relative"
        >
          <div className="relative mx-auto max-w-5xl">
            {/* Main Visual Placeholder */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl shadow-2xl p-8 backdrop-blur-sm border border-gray-700">
              <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">
                    Interactive Dashboard Preview
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    Real-time query execution and collaboration
                  </p>
                </div>
              </div>
            </div>

            {/* Floating Cards */}
            <motion.div
              animate={{ y: [-10, 10, -10] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-4 -left-4 bg-white rounded-xl shadow-lg p-4 border border-gray-200"
            >
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">
                  Connected to 12 databases
                </span>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [10, -10, 10] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }}
              className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg p-4 border border-gray-200"
            >
              <div className="flex items-center space-x-3">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium">
                  AI optimized 3 queries
                </span>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [-5, 5, -5] }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
              className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-xl shadow-lg p-4 border border-gray-200"
            >
              <div className="flex items-center space-x-3">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">
                  5 users collaborating
                </span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
