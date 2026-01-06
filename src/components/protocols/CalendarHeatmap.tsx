'use client'

import { useMemo } from 'react'

interface DailyProtocolEntry {
  id: string
  entry_date: string
  completion_percentage: number
  energy_level_rating: number | null
  sleep_quality_rating: number | null
}

interface CalendarHeatmapProps {
  entries: DailyProtocolEntry[]
}

export function CalendarHeatmap({ entries }: CalendarHeatmapProps) {
  // Build a map of date -> entry for quick lookup
  const entryMap = useMemo(() => {
    const map = new Map<string, DailyProtocolEntry>()
    entries.forEach((e) => map.set(e.entry_date, e))
    return map
  }, [entries])

  // Generate last 90 days
  const calendarDays = useMemo(() => {
    const days: { date: string; dayOfWeek: number }[] = []
    const today = new Date()

    for (let i = 89; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      days.push({
        date: d.toISOString().split('T')[0],
        dayOfWeek: d.getDay(),
      })
    }

    return days
  }, [])

  // Get color based on completion percentage
  const getColor = (percentage: number | undefined) => {
    if (percentage === undefined) return 'bg-neutral-100'
    if (percentage >= 80) return 'bg-green-500'
    if (percentage >= 60) return 'bg-green-400'
    if (percentage >= 40) return 'bg-green-300'
    if (percentage >= 20) return 'bg-green-200'
    if (percentage > 0) return 'bg-green-100'
    return 'bg-neutral-100'
  }

  // Get tooltip text
  const getTooltip = (date: string, entry?: DailyProtocolEntry) => {
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })

    if (!entry) return `${formattedDate}: No entry`

    return `${formattedDate}: ${entry.completion_percentage}% complete`
  }

  // Group days by week for grid layout
  const weeks = useMemo(() => {
    const result: { date: string; dayOfWeek: number }[][] = []
    let currentWeek: { date: string; dayOfWeek: number }[] = []

    // Pad first week with empty cells if needed
    if (calendarDays[0]) {
      for (let i = 0; i < calendarDays[0].dayOfWeek; i++) {
        currentWeek.push({ date: '', dayOfWeek: i })
      }
    }

    calendarDays.forEach((day) => {
      currentWeek.push(day)
      if (day.dayOfWeek === 6) {
        result.push(currentWeek)
        currentWeek = []
      }
    })

    // Push last incomplete week
    if (currentWeek.length > 0) {
      result.push(currentWeek)
    }

    return result
  }, [calendarDays])

  // Calculate stats
  const stats = useMemo(() => {
    const logged = entries.length
    const avgCompletion = logged > 0
      ? Math.round(entries.reduce((sum, e) => sum + (e.completion_percentage || 0), 0) / logged)
      : 0
    const perfectDays = entries.filter((e) => e.completion_percentage >= 80).length

    return { logged, avgCompletion, perfectDays }
  }, [entries])

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 bg-neutral-50 rounded-xl">
          <div className="text-2xl font-bold text-neutral-900">{stats.logged}</div>
          <div className="text-sm text-neutral-500">Days Logged</div>
        </div>
        <div className="text-center p-4 bg-neutral-50 rounded-xl">
          <div className="text-2xl font-bold text-neutral-900">{stats.avgCompletion}%</div>
          <div className="text-sm text-neutral-500">Avg Completion</div>
        </div>
        <div className="text-center p-4 bg-neutral-50 rounded-xl">
          <div className="text-2xl font-bold text-green-600">{stats.perfectDays}</div>
          <div className="text-sm text-neutral-500">80%+ Days</div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4">
        <div className="flex items-start gap-2">
          {/* Day labels */}
          <div className="flex flex-col gap-1 pt-6">
            {dayLabels.map((label, i) => (
              <div
                key={i}
                className="h-3 w-3 flex items-center justify-center text-[10px] text-neutral-400"
              >
                {i % 2 === 1 ? label : ''}
              </div>
            ))}
          </div>

          {/* Weeks */}
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                  {/* Month label on first day of month */}
                  <div className="h-4 text-[10px] text-neutral-400">
                    {week[0]?.date && new Date(week[0].date).getDate() <= 7
                      ? new Date(week[0].date).toLocaleString('en-US', { month: 'short' })
                      : ''}
                  </div>
                  {week.map((day, dayIndex) => {
                    if (!day.date) {
                      return <div key={dayIndex} className="w-3 h-3" />
                    }

                    const entry = entryMap.get(day.date)
                    const isToday = day.date === new Date().toISOString().split('T')[0]

                    return (
                      <div
                        key={day.date}
                        className={`w-3 h-3 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-neutral-400 hover:ring-offset-1 ${getColor(
                          entry?.completion_percentage
                        )} ${isToday ? 'ring-2 ring-neutral-900 ring-offset-1' : ''}`}
                        title={getTooltip(day.date, entry)}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-neutral-100">
          <span className="text-xs text-neutral-500">Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-neutral-100" title="No entry" />
            <div className="w-3 h-3 rounded-sm bg-green-100" title="1-19%" />
            <div className="w-3 h-3 rounded-sm bg-green-200" title="20-39%" />
            <div className="w-3 h-3 rounded-sm bg-green-300" title="40-59%" />
            <div className="w-3 h-3 rounded-sm bg-green-400" title="60-79%" />
            <div className="w-3 h-3 rounded-sm bg-green-500" title="80-100%" />
          </div>
          <span className="text-xs text-neutral-500">More</span>
        </div>
      </div>

      {/* Recent Activity */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-neutral-900">Recent Activity</h3>
          <div className="space-y-2">
            {entries.slice(0, 5).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
              >
                <div>
                  <div className="font-medium text-neutral-900">
                    {new Date(entry.entry_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="text-sm text-neutral-500">
                    {entry.energy_level_rating && `Energy: ${entry.energy_level_rating}/10`}
                    {entry.energy_level_rating && entry.sleep_quality_rating && ' • '}
                    {entry.sleep_quality_rating && `Sleep: ${entry.sleep_quality_rating}/10`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      entry.completion_percentage >= 80
                        ? 'bg-green-100 text-green-700'
                        : entry.completion_percentage >= 50
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {entry.completion_percentage}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="text-center py-8 text-neutral-500">
          <p>No protocol entries yet.</p>
          <p className="text-sm mt-1">Start logging your daily protocols to see your progress here!</p>
        </div>
      )}
    </div>
  )
}
