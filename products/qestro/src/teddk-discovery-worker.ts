/**
 * TEDDK Auto-Discovery Worker
 * API endpoint to automatically discover and test TEDDK
 */

import { TeddkDiscoveryService } from '../services/teddk-discovery';

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (request.method === 'POST' && url.pathname === '/api/teddk/discover') {
        const discoveryService = new TeddkDiscoveryService();

        console.log('🚀 Starting TEDDK auto-discovery...');
        const result = await discoveryService.discoverAndTest();

        console.log(`📊 Discovery completed: ${result.found ? 'FOUND' : 'NOT FOUND'}`);

        return new Response(JSON.stringify({
          success: true,
          timestamp: new Date().toISOString(),
          result
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      if (request.method === 'GET' && url.pathname === '/api/teddk/status') {
        // Quick status check
        const discoveryService = new TeddkDiscoveryService();
        const status = await discoveryService.checkTeddkStatus();

        return new Response(JSON.stringify({
          success: true,
          timestamp: new Date().toISOString(),
          status
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Default response
      return new Response(JSON.stringify({
        message: 'TEDDK Discovery Service',
        endpoints: {
          discover: 'POST /api/teddk/discover',
          status: 'GET /api/teddk/status'
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });

    } catch (error) {
      console.error('❌ Discovery error:', error);

      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};
