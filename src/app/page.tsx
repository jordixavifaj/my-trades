import CSVUploader from '@/components/CSVUploader';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">My Trades</h1>
          <p className="text-lg text-gray-600">Trading Journal Application</p>
        </div>
        
        <CSVUploader />
      </div>
    </main>
  )
}
