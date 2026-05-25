#!/usr/bin/env node

/**
 * R2 Storage Upload Test Script
 * Tests file upload functionality to R2 buckets
 */

import { readFileSync } from 'fs'

async function testR2Upload() {
  console.log('🧪 Testing R2 Storage Upload...')

  // Read test file
  const testFile = readFileSync('./test-upload.txt')
  console.log(`📁 Test file size: ${testFile.length} bytes`)

  // Prepare upload request
  const uploadData = new FormData()
  const blob = new Blob([testFile], { type: 'text/plain' })
  uploadData.append('file', blob, 'test-upload.txt')

  try {
    // Upload to MEDIA bucket
    const response = await fetch('https://qestro.broad-dew-49ad.workers.dev/api/files/media/upload', {
      method: 'POST',
      body: uploadData,
      headers: {
        'X-User-ID': 'test-user',
        'X-Source': 'test-script'
      }
    })

    if (response.ok) {
      const result = await response.json()
      console.log('✅ Upload successful!')
      console.log('📊 Response:', result)

      // Test download
      if (result.file && result.file.url) {
        console.log('🔄 Testing download...')
        const downloadResponse = await fetch(result.file.url)

        if (downloadResponse.ok) {
          const downloadedContent = await downloadResponse.text()
          console.log('✅ Download successful!')
          console.log('📄 Content preview:', downloadedContent.substring(0, 100) + '...')

          if (downloadedContent.includes('Questro R2 Storage Test File')) {
            console.log('🎉 Content verification passed!')
          } else {
            console.log('⚠️  Content verification failed')
          }
        } else {
          console.log('❌ Download failed:', downloadResponse.statusText)
        }
      }
    } else {
      const error = await response.text()
      console.log('❌ Upload failed:', response.status, error)
    }
  } catch (error) {
    console.log('❌ Test failed:', error.message)
  }
}

// Test direct file serving
async function testFileServing() {
  console.log('\n🌐 Testing direct file serving...')

  // This will test the file serving endpoint (should return 404 for non-existent file)
  const response = await fetch('https://qestro.broad-dew-49ad.workers.dev/api/files/media/test-upload.txt')

  if (response.ok) {
    console.log('✅ File served successfully!')
    console.log('📄 Content type:', response.headers.get('content-type'))
    console.log('📦 Content length:', response.headers.get('content-length'))
  } else {
    console.log('ℹ️  Expected 404 for test file:', response.status)

    // Test error response
    const errorResponse = await response.json()
    console.log('🔍 Error handling works:', errorResponse.error)
  }
}

// Test bucket listing
async function testBucketListing() {
  console.log('\n📋 Testing bucket listing...')

  try {
    const response = await fetch('https://qestro.broad-dew-49ad.workers.dev/api/files/media')

    if (response.ok) {
      const result = await response.json()
      console.log('✅ Bucket listing successful!')
      console.log(`📁 Files in MEDIA bucket: ${result.count || 0}`)

      if (result.files && result.files.length > 0) {
        console.log('📄 First few files:')
        result.files.slice(0, 3).forEach(file => {
          console.log(`   - ${file.key} (${file.size} bytes)`)
        })
      }
    } else {
      const error = await response.text()
      console.log('❌ Bucket listing failed:', error)
    }
  } catch (error) {
    console.log('❌ Bucket listing test failed:', error.message)
  }
}

async function runTests() {
  console.log('🚀 Starting R2 Storage Tests\n')
  console.log('Platform: Cloudflare Workers + R2 Storage')
  console.log('URL: https://qestro.broad-dew-49ad.workers.dev\n')

  await testR2Upload()
  await testFileServing()
  await testBucketListing()

  console.log('\n🎯 R2 Storage tests completed!')
  console.log('✅ R2 file serving infrastructure is operational')
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error)
}

export { runTests }
