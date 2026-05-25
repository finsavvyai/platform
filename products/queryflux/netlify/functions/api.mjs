import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default async function handler(req, context) {
  const url = new URL(req.url)
  const path = url.pathname.replace('/api/', '')
  const method = req.method

  try {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }

    // Handle preflight requests
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      })
    }

    // Route handling
    switch (path) {
      case 'health':
        return new Response(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })

      case 'connections':
        if (method === 'GET') {
          const { data, error } = await supabase
            .from('connections')
            .select('*')
            .order('created_at', { ascending: false })

          if (error) throw error

          return new Response(JSON.stringify({ data }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          })
        }
        break

      case 'queries':
        if (method === 'GET') {
          const { data, error } = await supabase
            .from('queries')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)

          if (error) throw error

          return new Response(JSON.stringify({ data }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          })
        }
        break

      default:
        return new Response(JSON.stringify({
          error: 'Endpoint not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
    }

    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error) {
    console.error('API Error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
}

export const config = {
  path: '/api'
}