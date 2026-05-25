import http from 'http'

const options = {
  host: 'localhost',
  port: process.env.PORT || 3001,
  path: '/health',
  timeout: 2000,
  method: 'GET'
}

const request = http.request(options, (res) => {
  console.log(`Health check status: ${res.statusCode}`)
  if (res.statusCode === 200) {
    process.exit(0)
  } else {
    process.exit(1)
  }
})

request.on('error', () => {
  console.log('Health check failed')
  process.exit(1)
})

request.on('timeout', () => {
  console.log('Health check timeout')
  request.destroy()
  process.exit(1)
})

request.end()
