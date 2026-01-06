'use client'

import { useState, useCallback } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Fire03Icon, Calendar03Icon, ChartHistogramIcon, Tick02Icon, AddCircleIcon } from '@hugeicons/core-free-icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'
import { DailyProtocolForm } from '@/components/protocols/DailyProtocolForm'
import { CalendarHeatmap } from '@/components/protocols/CalendarHeatmap'

interface DailyProtocolEntry {
  id: string
  user_id: string
  entry_date: string
  morning_light_time: string | null
  morning_light_duration_minutes: number | null
  first_meal_time: string | null
  wake_time: string | null
  first_meal_within_30min: boolean | null
  breakfast_protein_grams: number | null
  daily_carbs_grams: number | null
  blue_blockers_worn: boolean | null
  blue_blockers_start_time: string | null
  darkness_hours: number | null
  sleep_hours: number | null
  sleep_quality_rating: number | null
  bedtime: string | null
  phone_off_time: string | null
  wifi_off: boolean | null
  energy_level_rating: number | null
  symptom_notes: string | null
  completion_percentage: number
  created_at: string
  updated_at: string
}

interface ProtocolTrackerProps {
  initialEntries: DailyProtocolEntry[]
  currentStreak: number
}

export function ProtocolTracker({ initialEntries, currentStreak }: ProtocolTrackerProps) {
  const [entries, setEntries] = useState<DailyProtocolEntry[]>(initialEntries)
  const [streak, setStreak] = useState(currentStreak)
  const [activeTab, setActiveTab] = useState('log')
  const [isSaving, setIsSaving] = useState(false)

  // Get today's date
  const today = new Date().toISOString().split('T')[0]

  // Check if today's entry exists
  const todayEntry = entries.find(e => e.entry_date === today)

  // Calculate stats
  const avgCompletion = entries.length > 0
    ? Math.round(entries.reduce((sum, e) => sum + (e.completion_percentage || 0), 0) / entries.length)
    : 0

  const thisWeekEntries = entries.filter(e => {
    const entryDate = new Date(e.entry_date)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return entryDate >= weekAgo
  })

  const thisWeekAvgCompletion = thisWeekEntries.length > 0
    ? Math.round(thisWeekEntries.reduce((sum, e) => sum + (e.completion_percentage || 0), 0) / thisWeekEntries.length)
    : 0

  // Handle saving daily protocol
  const handleSave = useCallback(async (formData: Partial<DailyProtocolEntry>) => {
    setIsSaving(true)

    try {
      const response = await fetch('/api/protocols/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_date: formData.entry_date || today,
          morning_light_time: formData.morning_light_time,
          morning_light_duration_minutes: formData.morning_light_duration_minutes,
          first_meal_time: formData.first_meal_time,
          wake_time: formData.wake_time,
          first_meal_within_30min: formData.first_meal_within_30min,
          breakfast_protein_grams: formData.breakfast_protein_grams,
          daily_carbs_grams: formData.daily_carbs_grams,
          blue_blockers_worn: formData.blue_blockers_worn,
          blue_blockers_start_time: formData.blue_blockers_start_time,
          darkness_hours: formData.darkness_hours,
          sleep_hours: formData.sleep_hours,
          sleep_quality_rating: formData.sleep_quality_rating,
          bedtime: formData.bedtime,
          phone_off_time: formData.phone_off_time,
          wifi_off: formData.wifi_off,
          energy_level_rating: formData.energy_level_rating,
          symptom_notes: formData.symptom_notes,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save protocol')
      }

      const { entry, streak: newStreak } = await response.json()

      // Update local state
      setEntries(prev => {
        const filtered = prev.filter(e => e.entry_date !== entry.entry_date)
        return [entry, ...filtered].sort((a, b) =>
          new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
        )
      })
      setStreak(newStreak)

      toast.success('Protocol logged successfully! 🎉')
    } catch (error) {
      console.error('Error saving protocol:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save protocol')
    } finally {
      setIsSaving(false)
    }
  }, [today])

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Streak Counter */}
        <Card className="border-neutral-200">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${streak > 0 ? 'bg-orange-100' : 'bg-neutral-100'}`}>
                <HugeiconsIcon
                  icon={Fire03Icon}
                  size={28}
                  className={streak > 0 ? 'text-orange-500' : 'text-neutral-400'}
                />
              </div>
              <div>
                <div className="text-3xl font-bold text-neutral-900">
                  {streak}
                </div>
                <div className="text-sm text-neutral-500">
                  Day{streak !== 1 ? 's' : ''} Streak
                </div>
              </div>
            </div>
            {streak >= 7 && (
              <p className="text-sm text-orange-600 mt-3">
                🔥 You're on fire! Keep it going!
              </p>
            )}
          </CardContent>
        </Card>

        {/* This Week Adherence */}
        <Card className="border-neutral-200">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-green-100">
                <HugeiconsIcon icon={Tick02Icon} size={28} className="text-green-500" />
              </div>
              <div>
                <div className="text-3xl font-bold text-neutral-900">
                  {thisWeekAvgCompletion}%
                </div>
                <div className="text-sm text-neutral-500">
                  This Week Adherence
                </div>
              </div>
            </div>
            <p className="text-sm text-neutral-600 mt-3">
              {thisWeekEntries.length}/7 days logged
            </p>
          </CardContent>
        </Card>

        {/* 90-Day Average */}
        <Card className="border-neutral-200">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-blue-100">
                <HugeiconsIcon icon={ChartHistogramIcon} size={28} className="text-blue-500" />
              </div>
              <div>
                <div className="text-3xl font-bold text-neutral-900">
                  {avgCompletion}%
                </div>
                <div className="text-sm text-neutral-500">
                  90-Day Average
                </div>
              </div>
            </div>
            <p className="text-sm text-neutral-600 mt-3">
              {entries.length} total entries
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="log" className="flex items-center gap-2">
            <HugeiconsIcon icon={AddCircleIcon} size={16} />
            Log Today
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <HugeiconsIcon icon={Calendar03Icon} size={16} />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <HugeiconsIcon icon={ChartHistogramIcon} size={16} />
            Trends
          </TabsTrigger>
        </TabsList>

        {/* LOG TODAY TAB */}
        <TabsContent value="log">
          <DailyProtocolForm
            onSave={handleSave}
            existingEntry={todayEntry}
            isSaving={isSaving}
          />
        </TabsContent>

        {/* CALENDAR TAB */}
        <TabsContent value="calendar">
          <CalendarHeatmap entries={entries} />
        </TabsContent>

        {/* TRENDS TAB */}
        <TabsContent value="trends">
          <Card className="border-neutral-200">
            <CardHeader>
              <CardTitle>Energy & Sleep Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {entries.length < 7 ? (
                <div className="text-center py-12">
                  <HugeiconsIcon icon={ChartHistogramIcon} size={48} className="text-neutral-300 mx-auto mb-4" />
                  <p className="text-neutral-600">
                    Log at least 7 days of data to see trends
                  </p>
                  <p className="text-sm text-neutral-500 mt-2">
                    You have {entries.length} entries so far
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Energy Level Trend */}
                  <div>
                    <h3 className="font-medium mb-3">Energy Level (Last 30 Days)</h3>
                    <div className="h-20 flex items-end gap-1">
                      {entries.slice(0, 30).reverse().map((entry, idx) => (
                        <div
                          key={entry.id}
                          className="flex-1 rounded-t-sm transition-all"
                          style={{
                            height: `${(entry.energy_level_rating || 0) * 10}%`,
                            backgroundColor: entry.energy_level_rating
                              ? entry.energy_level_rating >= 7 ? '#22c55e'
                              : entry.energy_level_rating >= 5 ? '#f59e0b'
                              : '#ef4444'
                              : '#e5e5e5',
                          }}
                          title={`${entry.entry_date}: ${entry.energy_level_rating || 'N/A'}/10`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-neutral-500 mt-2">
                      <span>30 days ago</span>
                      <span>Today</span>
                    </div>
                  </div>

                  {/* Sleep Hours Trend */}
                  <div>
                    <h3 className="font-medium mb-3">Sleep Hours (Last 30 Days)</h3>
                    <div className="h-20 flex items-end gap-1">
                      {entries.slice(0, 30).reverse().map((entry) => (
                        <div
                          key={entry.id}
                          className="flex-1 rounded-t-sm transition-all"
                          style={{
                            height: `${Math.min((entry.sleep_hours || 0) / 10 * 100, 100)}%`,
                            backgroundColor: entry.sleep_hours
                              ? entry.sleep_hours >= 7 ? '#22c55e'
                              : entry.sleep_hours >= 6 ? '#f59e0b'
                              : '#ef4444'
                              : '#e5e5e5',
                          }}
                          title={`${entry.entry_date}: ${entry.sleep_hours || 'N/A'} hrs`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-neutral-500 mt-2">
                      <span>30 days ago</span>
                      <span>Today</span>
                    </div>
                  </div>

                  {/* Averages */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-neutral-900">
                        {(entries.reduce((sum, e) => sum + (e.energy_level_rating || 0), 0) / entries.filter(e => e.energy_level_rating).length || 0).toFixed(1)}
                      </div>
                      <div className="text-sm text-neutral-500">Avg Energy</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-neutral-900">
                        {(entries.reduce((sum, e) => sum + (e.sleep_hours || 0), 0) / entries.filter(e => e.sleep_hours).length || 0).toFixed(1)}
                      </div>
                      <div className="text-sm text-neutral-500">Avg Sleep (hrs)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-neutral-900">
                        {(entries.reduce((sum, e) => sum + (e.sleep_quality_rating || 0), 0) / entries.filter(e => e.sleep_quality_rating).length || 0).toFixed(1)}
                      </div>
                      <div className="text-sm text-neutral-500">Avg Sleep Quality</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
