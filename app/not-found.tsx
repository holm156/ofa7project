import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h2 className="text-4xl font-bold mb-4">404 - Not Found</h2>
      <p className="text-zinc-500 mb-8">The page you are looking for does not exist.</p>
      <Link 
        href="/"
        className="px-6 py-3 bg-primary hover:bg-primaryDark text-white rounded-lg transition-colors font-medium"
      >
        Return Home
      </Link>
    </div>
  );
}
