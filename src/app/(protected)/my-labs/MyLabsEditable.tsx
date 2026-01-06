'use client'

import { useState, useCallback } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Calendar03Icon, Alert01Icon, AddCircleIcon, ChartHistogramIcon, Tick02Icon } from '@hugeicons/core-free-icons'
import { LabCalculator, LabSaveOptions } from '@/components/labs/LabCalculator'
import { LabHistoryChart } from '@/components/labs/LabHistoryChart'
import { TrendIndicator } from '@/components/labs/TrendIndicator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import type { LabFormValues, LabCalculationResult, PatientContext } from '@/types/labs'
import toast from 'react-hot-toast'

interface MemberLabValue {
  id: string
  marker_name: string
  value: number
  unit: string
  test_date: string
  evaluation: string | null
  delta_from_target: number | null
  is_ominous: boolean
  weakness_text: string | null
  category: string | null
  created_at: string
}

interface Marker {
  id: string
  name: string
  display_name: string
  unit: string | null
  category: string
}

interface MyLabsEditableProps {
  initialValues: MemberLabValue[]
  markers: Marker[]
  memberProfile?: {
    gender?: 'male' | 'female'
    dateOfBirth?: string
    age?: number
  }
}

export function MyLabsEditable({ initialValues, markers, memberProfile }: MyLabsEditableProps) {
  const [labValues, setLabValues] = useState<MemberLabValue[]>(initialValues)
  const [activeTab, setActiveTab] = useState('add')
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const markerMap = new Map(markers.map((m) => [m.id, m]))

  // Get unique test dates from member's lab values
  const testDates = [...new Set(labValues.map(v => v.test_date))].sort().reverse()

  // Group lab values by test date
  const valuesByDate = testDates.reduce((acc, date) => {
    acc[date] = labValues.filter(v => v.test_date === date)
    return acc
  }, {} as Record<string, MemberLabValue[]>)

  // Get unique markers from member's lab values
  const availableMarkers = [...new Set(labValues.map(v => v.marker_name))]

  // Build chart data for selected marker
  const chartData = selectedMarker
    ? labValues
        .filter(v => v.marker_name === selectedMarker)
        .map(v => ({
          date: v.test_date,
          value: v.value,
          evaluation: v.evaluation,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : []

  // Handle saving lab results from the calculator
  const handleSave = useCallback(async (
    results: LabCalculationResult,
    values: LabFormValues,
    options?: LabSaveOptions
  ) => {
    setIsSaving(true)

    try {
      // Build array of lab values to save
      const testDate = new Date().toISOString().split('T')[0]
      const labValuesToSave = results.results
        .filter(r => r.value != null)
        .map(r => {
          const marker = markers.find(m => m.id === r.markerId)
          return {
            marker_name: marker?.display_name || marker?.name || r.markerId,
            value: r.value,
            unit: marker?.unit || '',
            test_date: testDate,
            evaluation: r.evaluation,
            delta_from_target: r.delta,
            is_ominous: r.isOminous || false,
            weakness_text: r.weaknessText,
            category: marker?.category,
            source: options?.sourceType || 'manual',
          }
        })

      if (labValuesToSave.length === 0) {
        toast.error('No lab values to save')
        return
      }

      // Save via API (bulk insert)
      const response = await fetch('/api/member/lab-values', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(labValuesToSave),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save lab values')
      }

      const { labValues: savedValues } = await response.json()

      // Update local state
      setLabValues(prev => [...savedValues, ...prev])

      toast.success(`Saved ${savedValues.length} lab values successfully!`)

      // Switch to history tab to show new results
      setActiveTab('history')
    } catch (error) {
      console.error('Error saving lab values:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save lab values')
    } finally {
      setIsSaving(false)
    }
  }, [markers])

  // Build patient context from member profile
  const patientContext: PatientContext = {
    gender: memberProfile?.gender || 'male',
    age: memberProfile?.age || 45,
    dateOfBirth: memberProfile?.dateOfBirth ? new Date(memberProfile.dateOfBirth) : undefined,
  }

  // Count totals for each test date
  const getDateStats = (date: string) => {
    const dateValues = valuesByDate[date] || []
    const ominousCount = dateValues.filter(v => v.is_ominous).length
    return {
      total: dateValues.length,
      ominousCount,
    }
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-6">
        <TabsTrigger value="add" className="flex items-center gap-2">
          <HugeiconsIcon icon={AddCircleIcon} size={16} />
          Add Results
        </TabsTrigger>
        <TabsTrigger value="history" className="flex items-center gap-2">
          <HugeiconsIcon icon={Calendar03Icon} size={16} />
          History
        </TabsTrigger>
        <TabsTrigger value="trends" className="flex items-center gap-2">
          <HugeiconsIcon icon={ChartHistogramIcon} size={16} />
          Trends
        </TabsTrigger>
      </TabsList>

      {/* ADD LAB RESULTS TAB */}
      <TabsContent value="add">
        <Card className="border-neutral-200">
          <CardHeader>
            <CardTitle>Enter Lab Results</CardTitle>
            <p className="text-sm text-neutral-600 mt-1">
              Enter your lab values manually or upload a PDF/image of your lab report
            </p>
          </CardHeader>
          <CardContent>
            <LabCalculator
              onSave={handleSave}
              patient={memberProfile ? {
                id: 'self',
                userId: 'self',
                firstName: 'My',
                lastName: 'Results',
                gender: memberProfile.gender || 'male',
                dateOfBirth: memberProfile.dateOfBirth ? new Date(memberProfile.dateOfBirth) : new Date(),
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
              } : undefined}
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* HISTORY TAB */}
      <TabsContent value="history">
        {testDates.length === 0 ? (
          <Card className="border-neutral-200">
            <CardContent className="py-12 text-center">
              <p className="text-neutral-600 mb-4">No lab results yet.</p>
              <button
                onClick={() => setActiveTab('add')}
                className="text-sm text-neutral-900 underline hover:no-underline"
              >
                Add your first lab results →
              </button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <h2 className="font-medium text-neutral-900">Lab Results Timeline</h2>

            {testDates.map((date) => {
              const stats = getDateStats(date)
              const dateValues = valuesByDate[date] || []

              return (
                <Card key={date} className="border-neutral-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <HugeiconsIcon icon={Calendar03Icon} size={18} className="text-neutral-400" />
                        <span className="font-medium text-neutral-900">
                          {new Date(date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-500">
                          {stats.total} markers
                        </span>
                        {stats.ominousCount > 0 && (
                          <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                            <HugeiconsIcon icon={Alert01Icon} size={12} />
                            {stats.ominousCount} critical
                          </span>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {dateValues.map((value) => (
                        <div
                          key={value.id}
                          className={`p-3 rounded-lg border ${
                            value.is_ominous
                              ? 'border-red-200 bg-red-50'
                              : value.evaluation === 'normal'
                              ? 'border-green-200 bg-green-50'
                              : value.evaluation === 'high' || value.evaluation === 'low'
                              ? 'border-amber-200 bg-amber-50'
                              : 'border-neutral-200 bg-neutral-50'
                          }`}
                        >
                          <div className="text-xs text-neutral-500 truncate">
                            {value.marker_name}
                          </div>
                          <div className="font-semibold text-neutral-900 mt-1">
                            {value.value} <span className="text-xs font-normal text-neutral-500">{value.unit}</span>
                          </div>
                          {value.evaluation && (
                            <div className={`text-xs mt-1 capitalize ${
                              value.is_ominous ? 'text-red-700' :
                              value.evaluation === 'normal' ? 'text-green-700' :
                              'text-amber-700'
                            }`}>
                              {value.is_ominous ? '⚠️ Critical' : value.evaluation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </TabsContent>

      {/* TRENDS TAB */}
      <TabsContent value="trends">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Marker selector */}
          <Card className="border-neutral-200">
            <CardHeader>
              <CardTitle className="text-base">Select Marker</CardTitle>
            </CardHeader>
            <CardContent>
              {availableMarkers.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No markers tracked yet. Add lab results to see trends.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {availableMarkers.map((markerName) => {
                    const markerValues = labValues.filter(v => v.marker_name === markerName)
                    const latestValue = markerValues[0]

                    return (
                      <button
                        key={markerName}
                        onClick={() => setSelectedMarker(markerName)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          selectedMarker === markerName
                            ? 'bg-neutral-900 text-white'
                            : 'bg-neutral-50 hover:bg-neutral-100'
                        }`}
                      >
                        <div className="text-sm font-medium truncate">{markerName}</div>
                        <div className={`text-xs ${selectedMarker === markerName ? 'text-neutral-300' : 'text-neutral-500'}`}>
                          {markerValues.length} records • Latest: {latestValue?.value} {latestValue?.unit}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chart */}
          <div className="lg:col-span-2">
            {selectedMarker && chartData.length > 0 ? (
              <Card className="border-neutral-200">
                <CardHeader>
                  <CardTitle className="text-base">{selectedMarker} Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <LabHistoryChart
                    data={chartData}
                    unit={labValues.find(v => v.marker_name === selectedMarker)?.unit || ''}
                  />

                  {/* Trend indicator */}
                  {chartData.length >= 2 && (
                    <div className="mt-4 pt-4 border-t border-neutral-100">
                      <TrendIndicator
                        current={chartData[chartData.length - 1]?.value}
                        previous={chartData[chartData.length - 2]?.value}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : selectedMarker && chartData.length < 2 ? (
              <Card className="border-neutral-200">
                <CardContent className="py-12 text-center">
                  <p className="text-neutral-600">
                    Need at least 2 data points to show a trend chart.
                  </p>
                  <p className="text-sm text-neutral-500 mt-2">
                    Add more lab results to track changes over time.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-neutral-200">
                <CardContent className="py-12 text-center">
                  <HugeiconsIcon icon={ChartHistogramIcon} size={48} className="text-neutral-300 mx-auto mb-4" />
                  <p className="text-neutral-600">
                    Select a marker to view its trend over time
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
