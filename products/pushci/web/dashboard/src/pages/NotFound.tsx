import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 sm:py-32 md:py-40 text-center">
      <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-zinc-300 mb-2">
        Page not found
      </h2>
      <p className="text-zinc-500 mb-8 max-w-md">
        The page you're looking for doesn't exist.
      </p>
      <Link
        to="/runs"
        className="px-6 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 transition"
      >
        Go to Dashboard
      </Link>
    </div>
  )
}
