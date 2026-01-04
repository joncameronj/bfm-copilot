'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

// SpeechRecognition types (Web Speech API)
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

interface SpeechRecognitionInstance {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

// Extend Window interface for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance
    webkitSpeechRecognition: new () => SpeechRecognitionInstance
  }
}

interface UseVoiceInputOptions {
  onResult?: (transcript: string) => void
  onError?: (error: string) => void
  onInterimResult?: (transcript: string) => void
  language?: string
  continuous?: boolean
}

interface UseVoiceInputReturn {
  isListening: boolean
  transcript: string
  interimTranscript: string
  isSupported: boolean
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
}

export function useVoiceInput(
  options: UseVoiceInputOptions = {}
): UseVoiceInputReturn {
  const {
    onResult,
    onError,
    onInterimResult,
    language = 'en-US',
    continuous = false,
  } = options

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(false)

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => {
    // Check for browser support
    const supported =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

    setIsSupported(supported)

    return () => {
      // Cleanup on unmount
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
    }
  }, [])

  const startListening = useCallback(() => {
    if (!isSupported) {
      onError?.('Speech recognition is not supported in this browser')
      return
    }

    try {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()

      recognition.lang = language
      recognition.interimResults = true
      recognition.continuous = continuous
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsListening(true)
        setTranscript('')
        setInterimTranscript('')
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = ''
        let interimText = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript
          } else {
            interimText += result[0].transcript
          }
        }

        if (finalTranscript) {
          setTranscript((prev) => prev + finalTranscript)
          onResult?.(finalTranscript)
        }

        if (interimText) {
          setInterimTranscript(interimText)
          onInterimResult?.(interimText)
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsListening(false)

        // Map error codes to user-friendly messages
        const errorMessages: Record<string, string> = {
          'no-speech': 'No speech was detected. Please try again.',
          'audio-capture': 'No microphone was found.',
          'not-allowed': 'Microphone permission was denied.',
          'network': 'A network error occurred.',
          'aborted': 'Speech recognition was aborted.',
          'language-not-supported': 'The language is not supported.',
          'service-not-allowed': 'Speech recognition service is not allowed.',
        }

        const errorMessage =
          errorMessages[event.error] ||
          `Speech recognition error: ${event.error}`
        onError?.(errorMessage)
      }

      recognition.onend = () => {
        setIsListening(false)
        setInterimTranscript('')
      }

      recognition.start()
      recognitionRef.current = recognition
    } catch (error) {
      setIsListening(false)
      onError?.(
        error instanceof Error ? error.message : 'Failed to start speech recognition'
      )
    }
  }, [isSupported, language, continuous, onResult, onError, onInterimResult])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
  }, [])

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  }
}
