import Link from 'next/link'

export default function PurchaseSuccessPage() {
  return (
    <div className="text-center">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
        Purchase received
      </h2>
      <p className="mt-2 text-neutral-500 dark:text-neutral-400">
        We are setting up your Copilot account now. Check your email for your
        account setup link. If you already have an account, you can sign in with
        your existing password.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Link href="/login" className="text-brand-blue hover:underline">
          Go to login
        </Link>
        <Link
          href="/reset-password"
          className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
        >
          Didn&apos;t get the email? Request a new reset link
        </Link>
      </div>
    </div>
  )
}
