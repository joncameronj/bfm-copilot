'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Loading03Icon,
  Tick02Icon,
  Alert01Icon,
  File01Icon,
  ArrowDown01Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

type Stage = 'idle' | 'uploading' | 'extracting' | 'analyzing' | 'complete' | 'error'

const STAGE_LABELS: Record<Exclude<Stage, 'idle' | 'complete' | 'error'>, { title: string; sub: string }> = {
  uploading: {
    title: 'Uploading PDF...',
    sub: 'Sending to server',
  },
  extracting: {
    title: 'Reading lab values...',
    sub: 'Vision AI is extracting all markers from the PDF (30–60 sec)',
  },
  analyzing: {
    title: 'Running BFM analysis...',
    sub: 'Matching protocols to lab values (2–3 min)',
  },
}

interface BloodPanelUploadProps {
  patientId: string
  onComplete?: () => void
  className?: string
}

export function BloodPanelUpload({ patientId, onComplete, className }: BloodPanelUploadProps) {
  const [stage, setStage] = useState<Stage>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [elapsedSecs, setElapsedSecs] = useState(0)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startElapsed = () => {
    setElapsedSecs(0)
    elapsedRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000)
  }

  const stopElapsed = () => {
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current)
      elapsedRef.current = null
    }
  }

  // Poll while extraction/eval is in progress. The first API response usually
  // reports "extracting"; polling is what advances it to analyzing/finalizing.
  useEffect(() => {
    if ((stage !== 'extracting' && stage !== 'analyzing') || !uploadId) return

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/diagnostics/${uploadId}/generate-analysis`)
        if (!res.ok) return
        const data = await res.json()
        const status = data?.data?.status
        const remoteStage = data?.data?.stage

        if (status === 'complete') {
          stopElapsed()
          setStage('complete')
          onComplete?.()
          clearInterval(pollRef.current!)
          pollRef.current = null
          toast.success('Blood panel processed and analysis complete')
        } else if (status === 'error') {
          stopElapsed()
          const msg = data?.data?.errorMessage || 'Analysis failed'
          setStage('error')
          setErrorMessage(msg)
          clearInterval(pollRef.current!)
          pollRef.current = null
        } else if (remoteStage === 'extracting') {
          setStage('extracting')
        } else if (remoteStage) {
          setStage('analyzing')
        }
      } catch {
        // Silently ignore poll failures — network blip, not fatal
      }
    }, 4000)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [stage, uploadId, onComplete])

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      stopElapsed()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    setStage('uploading')
    setErrorMessage(null)
    setUploadId(null)
    startElapsed()

    try {
      // ── Step 1: Upload the file ──────────────────────────────────────
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'blood_panel')
      formData.append('patientId', patientId)

      const uploadRes = await fetch('/api/diagnostics/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => null)
        throw new Error(err?.error || 'Upload failed')
      }

      const uploadData = await uploadRes.json()
      const newUploadId = uploadData.data?.uploadId
      if (!newUploadId) throw new Error('No upload ID returned')

      setUploadId(newUploadId)
      setStage('extracting')

      // ── Step 2: Kick off extraction + eval ─────────────────────────
      // This returns quickly; extraction and eval continue in the background.
      const abortCtrl = new AbortController()
      const abortTimeout = setTimeout(() => abortCtrl.abort(), 130_000)

      let analyzeRes: Response
      try {
        analyzeRes = await fetch(`/api/diagnostics/${newUploadId}/generate-analysis`, {
          method: 'POST',
          signal: abortCtrl.signal,
        })
      } finally {
        clearTimeout(abortTimeout)
      }

      if (!analyzeRes.ok) {
        const err = await analyzeRes.json().catch(() => null)
        throw new Error(err?.error || 'Extraction failed')
      }

      const analyzeData = await analyzeRes.json()
      const status = analyzeData?.data?.status
      const remoteStage = analyzeData?.data?.stage

      if (status === 'complete') {
        // Rare: already done (e.g. re-running on existing extraction)
        stopElapsed()
        setStage('complete')
        onComplete?.()
        toast.success('Blood panel processed and analysis complete')
      } else {
        setStage(remoteStage === 'extracting' ? 'extracting' : 'analyzing')
      }
    } catch (error) {
      stopElapsed()
      const message = error instanceof Error
        ? (error.name === 'AbortError' ? 'Request timed out — try again' : error.message)
        : 'Upload failed'
      setStage('error')
      setErrorMessage(message)
      toast.error(message)
    }
  }, [patientId, onComplete])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxFiles: 1,
    disabled: stage !== 'idle' && stage !== 'error',
  })

  const reset = useCallback(() => {
    stopElapsed()
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setStage('idle')
    setErrorMessage(null)
    setUploadId(null)
    setElapsedSecs(0)
  }, [])

  const elapsedLabel = elapsedSecs >= 60
    ? `${Math.floor(elapsedSecs / 60)}:${String(elapsedSecs % 60).padStart(2, '0')}`
    : `${elapsedSecs}s`

  // ── Complete state ───────────────────────────────────────────────────
  if (stage === 'complete') {
    return (
      <div className={cn('flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl', className)}>
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <HugeiconsIcon icon={Tick02Icon} size={16} className="text-green-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-green-900">Blood panel processed</p>
          <p className="text-xs text-green-700">
            Lab values saved • Analysis complete
            <HugeiconsIcon icon={ArrowDown01Icon} size={12} className="inline ml-1" />
          </p>
        </div>
        <button
          onClick={reset}
          className="text-xs text-green-600 hover:text-green-800 underline flex-shrink-0"
        >
          Upload another
        </button>
      </div>
    )
  }

  // ── In-progress state ────────────────────────────────────────────────
  if (stage === 'uploading' || stage === 'extracting' || stage === 'analyzing') {
    const { title, sub } = STAGE_LABELS[stage]
    return (
      <div className={cn('flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl', className)}>
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <HugeiconsIcon icon={Loading03Icon} size={16} className="text-blue-600 animate-spin" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-900">{title}</p>
          <p className="text-xs text-blue-700 truncate">{sub}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs text-blue-600 tabular-nums">{elapsedLabel}</span>
        </div>
      </div>
    )
  }

  // ── Idle / error state ───────────────────────────────────────────────
  return (
    <div className={className}>
      {stage === 'error' && errorMessage && (
        <div className="flex items-center gap-2 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <HugeiconsIcon icon={Alert01Icon} size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-700 flex-1">{errorMessage}</p>
          <button
            onClick={reset}
            className="text-xs text-red-600 hover:text-red-800 underline flex-shrink-0"
          >
            Try again
          </button>
        </div>
      )}

      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center">
            <HugeiconsIcon
              icon={File01Icon}
              size={20}
              className={isDragActive ? 'text-blue-500' : 'text-neutral-500'}
            />
          </div>
          {isDragActive ? (
            <p className="text-sm font-medium text-blue-700">Drop the PDF</p>
          ) : (
            <>
              <p className="text-sm font-medium text-neutral-700">
                Drop blood panel PDF here
              </p>
              <p className="text-xs text-neutral-400">
                LabCorp, Quest, or any blood panel &bull; PDF, JPEG, or PNG
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
