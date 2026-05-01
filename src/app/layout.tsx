import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI System Design Assistant',
  description: 'Transform your project ideas into professional system architectures with AI-powered guidance',
  keywords: ['system design', 'architecture', 'AI', 'watsonx', 'IBM'],
  authors: [{ name: 'IBM Hackathon Team' }],
  openGraph: {
    title: 'AI System Design Assistant',
    description: 'Transform your project ideas into professional system architectures',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <header className="border-b bg-white shadow-sm">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <svg
                    className="w-8 h-8 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                    />
                  </svg>
                  <h1 className="text-xl font-bold text-gray-900">
                    AI System Design Assistant
                  </h1>
                </div>
                <nav className="flex items-center space-x-4">
                  <a
                    href="/"
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Home
                  </a>
                  <a
                    href="/history"
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Project History
                  </a>
                </nav>
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t bg-gray-50 py-6">
            <div className="container mx-auto px-4 text-center text-gray-600 text-sm">
              <p>
                Powered by{' '}
                <span className="font-semibold text-blue-600">
                  IBM watsonx.ai
                </span>
              </p>
              <p className="mt-2">
                © 2026 AI System Design Assistant. Built for IBM Hackathon.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

// Made with Bob
