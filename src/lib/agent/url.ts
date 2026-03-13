const LOCAL_AGENT_URL = 'http://localhost:8000'

export function getPythonAgentUrl(): string {
  const configured =
    process.env.PYTHON_AGENT_URL ||
    process.env.RAILWAY_PYTHON_AGENT_URL

  if (!configured && process.env.NODE_ENV === 'production') {
    console.warn(
      '[getPythonAgentUrl] PYTHON_AGENT_URL is not set — falling back to localhost:8000. ' +
      'This will fail in serverless environments like Vercel.'
    )
  }

  return (configured || LOCAL_AGENT_URL).replace(/\/$/, '')
}
