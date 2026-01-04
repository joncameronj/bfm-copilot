'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafafa',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{
            maxWidth: '400px',
            padding: '32px',
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}>
            <h2 style={{ margin: '0 0 8px', color: '#171717' }}>
              Something went wrong
            </h2>
            <p style={{ margin: '0 0 24px', color: '#737373' }}>
              {error.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={reset}
              style={{
                padding: '10px 24px',
                backgroundColor: '#171717',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
