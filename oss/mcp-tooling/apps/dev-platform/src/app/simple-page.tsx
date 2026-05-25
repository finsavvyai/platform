export default function SimplePage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Developer Platform</h1>
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Simple Test Page</h2>
          <p className="text-gray-300 mb-4">This page tests the basic build without UI components.</p>
          <button className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg">
            Test Button
          </button>
        </div>
      </div>
    </div>
  )
}