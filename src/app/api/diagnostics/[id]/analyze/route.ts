import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Legacy compatibility endpoint.
// Redirects to the canonical analysis generation route.
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params
  const target = new URL(`/api/diagnostics/${id}/generate-analysis`, request.url)
  return NextResponse.redirect(target, 307)
}

// Legacy compatibility endpoint for polling status.
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params
  const target = new URL(`/api/diagnostics/${id}/generate-analysis`, request.url)
  return NextResponse.redirect(target, 307)
}
