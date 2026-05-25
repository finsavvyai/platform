import React from 'react'

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-muted/30 border-t border-border mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Company */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SDLC</span>
              </div>
              <span className="font-semibold">SDLC.ai</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Enterprise-grade AI-powered software development lifecycle platform.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h3 className="font-semibold">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/features" className="hover:text-foreground">Features</a></li>
              <li><a href="/pricing" className="hover:text-foreground">Pricing</a></li>
              <li><a href="/api-reference" className="hover:text-foreground">API Reference</a></li>
              <li><a href="/status" className="hover:text-foreground">Status</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="font-semibold">Resources</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/docs" className="hover:text-foreground">Documentation</a></li>
              <li><a href="/examples" className="hover:text-foreground">Code Examples</a></li>
              <li><a href="/blog" className="hover:text-foreground">Blog</a></li>
              <li><a href="/support" className="hover:text-foreground">Support</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h3 className="font-semibold">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/privacy" className="hover:text-foreground">Privacy Policy</a></li>
              <li><a href="/terms" className="hover:text-foreground">Terms of Service</a></li>
              <li><a href="/security" className="hover:text-foreground">Security</a></li>
              <li><a href="/compliance" className="hover:text-foreground">Compliance</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground">
            © {currentYear} SDLC.ai. All rights reserved.
          </p>

          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <span className="text-sm text-muted-foreground">
              Built with enterprise-grade security and reliability.
            </span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-muted-foreground">All systems operational</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
