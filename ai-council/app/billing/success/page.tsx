import Link from 'next/link'

export default function BillingSuccess() {
  return (
    <div className="min-h-screen p-8 flex items-center justify-center">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold mb-4">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">
          Your credits have been added to your account.
        </p>
        <Link
          href="/"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block"
        >
          Return to Home
        </Link>
      </div>
    </div>
  )
}

