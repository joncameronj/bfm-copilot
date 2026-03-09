const LOCAL_AGENT_URL = 'http://localhost:8000'

export function getPythonAgentUrl(): string {
  const configured =
    process.env.PYTHON_AGENT_URL ||
    process.env.RAILWAY_PYTHON_AGENT_URL ||
    LOCAL_AGENT_URL

  return configured.replace(/\/$/, '')
}
