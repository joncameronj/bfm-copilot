'use client'

import { useState, useEffect } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Sun03Icon, Moon02Icon, RestaurantIcon, Clock01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'

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

interface DailyProtocolFormProps {
  onSave: (formData: Partial<DailyProtocolEntry>) => Promise<void>
  existingEntry?: DailyProtocolEntry
  isSaving: boolean
}

export function DailyProtocolForm({ onSave, existingEntry, isSaving }: DailyProtocolFormProps) {
  const today = new Date().toISOString().split('T')[0]

  // Form state
  const [morningLightTime, setMorningLightTime] = useState(existingEntry?.morning_light_time || '')
  const [morningLightDuration, setMorningLightDuration] = useState(existingEntry?.morning_light_duration_minutes?.toString() || '')
  const [wakeTime, setWakeTime] = useState(existingEntry?.wake_time || '')
  const [firstMealTime, setFirstMealTime] = useState(existingEntry?.first_meal_time || '')
  const [firstMealWithin30, setFirstMealWithin30] = useState(existingEntry?.first_meal_within_30min || false)
  const [breakfastProtein, setBreakfastProtein] = useState(existingEntry?.breakfast_protein_grams?.toString() || '')
  const [dailyCarbs, setDailyCarbs] = useState(existingEntry?.daily_carbs_grams?.toString() || '')
  const [blueBlockersWorn, setBlueBlockersWorn] = useState(existingEntry?.blue_blockers_worn || false)
  const [blueBlockersTime, setBlueBlockersTime] = useState(existingEntry?.blue_blockers_start_time || '')
  const [darknessHours, setDarknessHours] = useState(existingEntry?.darkness_hours?.toString() || '')
  const [sleepHours, setSleepHours] = useState(existingEntry?.sleep_hours?.toString() || '')
  const [sleepQuality, setSleepQuality] = useState(existingEntry?.sleep_quality_rating || 5)
  const [bedtime, setBedtime] = useState(existingEntry?.bedtime || '')
  const [phoneOffTime, setPhoneOffTime] = useState(existingEntry?.phone_off_time || '')
  const [wifiOff, setWifiOff] = useState(existingEntry?.wifi_off || false)
  const [energyLevel, setEnergyLevel] = useState(existingEntry?.energy_level_rating || 5)
  const [symptomNotes, setSymptomNotes] = useState(existingEntry?.symptom_notes || '')

  // Update form when existingEntry changes
  useEffect(() => {
    if (existingEntry) {
      setMorningLightTime(existingEntry.morning_light_time || '')
      setMorningLightDuration(existingEntry.morning_light_duration_minutes?.toString() || '')
      setWakeTime(existingEntry.wake_time || '')
      setFirstMealTime(existingEntry.first_meal_time || '')
      setFirstMealWithin30(existingEntry.first_meal_within_30min || false)
      setBreakfastProtein(existingEntry.breakfast_protein_grams?.toString() || '')
      setDailyCarbs(existingEntry.daily_carbs_grams?.toString() || '')
      setBlueBlockersWorn(existingEntry.blue_blockers_worn || false)
      setBlueBlockersTime(existingEntry.blue_blockers_start_time || '')
      setDarknessHours(existingEntry.darkness_hours?.toString() || '')
      setSleepHours(existingEntry.sleep_hours?.toString() || '')
      setSleepQuality(existingEntry.sleep_quality_rating || 5)
      setBedtime(existingEntry.bedtime || '')
      setPhoneOffTime(existingEntry.phone_off_time || '')
      setWifiOff(existingEntry.wifi_off || false)
      setEnergyLevel(existingEntry.energy_level_rating || 5)
      setSymptomNotes(existingEntry.symptom_notes || '')
    }
  }, [existingEntry])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const formData: Partial<DailyProtocolEntry> = {
      entry_date: today,
      morning_light_time: morningLightTime || null,
      morning_light_duration_minutes: morningLightDuration ? parseInt(morningLightDuration) : null,
      wake_time: wakeTime || null,
      first_meal_time: firstMealTime || null,
      first_meal_within_30min: firstMealWithin30,
      breakfast_protein_grams: breakfastProtein ? parseFloat(breakfastProtein) : null,
      daily_carbs_grams: dailyCarbs ? parseFloat(dailyCarbs) : null,
      blue_blockers_worn: blueBlockersWorn,
      blue_blockers_start_time: blueBlockersTime || null,
      darkness_hours: darknessHours ? parseFloat(darknessHours) : null,
      sleep_hours: sleepHours ? parseFloat(sleepHours) : null,
      sleep_quality_rating: sleepQuality,
      bedtime: bedtime || null,
      phone_off_time: phoneOffTime || null,
      wifi_off: wifiOff,
      energy_level_rating: energyLevel,
      symptom_notes: symptomNotes || null,
    }

    await onSave(formData)
  }

  // Toggle component for boolean fields
  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
        checked
          ? 'bg-green-50 border-green-200 text-green-700'
          : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
      }`}
    >
      <div
        className={`w-10 h-6 rounded-full transition-colors flex items-center ${
          checked ? 'bg-green-500' : 'bg-neutral-300'
        }`}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  )

  // Rating slider component
  const RatingSlider = ({
    value,
    onChange,
    label,
    lowLabel,
    highLabel,
  }: {
    value: number
    onChange: (v: number) => void
    label: string
    lowLabel: string
    highLabel: string
  }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-neutral-700">{label}</label>
      <div className="flex items-center gap-4">
        <span className="text-xs text-neutral-500 w-16">{lowLabel}</span>
        <input
          type="range"
          min="1"
          max="10"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-neutral-900"
        />
        <span className="text-xs text-neutral-500 w-16 text-right">{highLabel}</span>
      </div>
      <div className="flex justify-center">
        <span className="text-2xl font-bold text-neutral-900">{value}</span>
        <span className="text-sm text-neutral-500 ml-1 self-end mb-1">/10</span>
      </div>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Morning Section */}
      <Card className="border-neutral-200">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 rounded-xl bg-amber-100">
              <HugeiconsIcon icon={Sun03Icon} size={20} className="text-amber-600" />
            </div>
            Morning Routine
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="time"
              label="Wake Time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
            />
            <Input
              type="time"
              label="Morning Light Exposure Time"
              value={morningLightTime}
              onChange={(e) => setMorningLightTime(e.target.value)}
            />
          </div>
          <Input
            type="number"
            label="Morning Light Duration (minutes)"
            value={morningLightDuration}
            onChange={(e) => setMorningLightDuration(e.target.value)}
            placeholder="e.g., 15"
            min="0"
            max="180"
          />
          <p className="text-xs text-neutral-500">
            Get outside within 30 minutes of waking for 10-30 minutes of sunlight exposure.
          </p>
        </CardContent>
      </Card>

      {/* Nutrition Section */}
      <Card className="border-neutral-200">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 rounded-xl bg-green-100">
              <HugeiconsIcon icon={RestaurantIcon} size={20} className="text-green-600" />
            </div>
            Nutrition
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="time"
              label="First Meal Time"
              value={firstMealTime}
              onChange={(e) => setFirstMealTime(e.target.value)}
            />
            <div className="flex items-end">
              <Toggle
                checked={firstMealWithin30}
                onChange={setFirstMealWithin30}
                label="Ate within 30 min of waking"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="number"
              label="Breakfast Protein (grams)"
              value={breakfastProtein}
              onChange={(e) => setBreakfastProtein(e.target.value)}
              placeholder="e.g., 30"
              min="0"
            />
            <Input
              type="number"
              label="Daily Carbs (grams)"
              value={dailyCarbs}
              onChange={(e) => setDailyCarbs(e.target.value)}
              placeholder="e.g., 100"
              min="0"
            />
          </div>
          <p className="text-xs text-neutral-500">
            Aim for 30-50g protein at breakfast. Keep carbs under control based on your goals.
          </p>
        </CardContent>
      </Card>

      {/* Evening & Sleep Section */}
      <Card className="border-neutral-200">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 rounded-xl bg-indigo-100">
              <HugeiconsIcon icon={Moon02Icon} size={20} className="text-indigo-600" />
            </div>
            Evening & Sleep
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Toggle
              checked={blueBlockersWorn}
              onChange={setBlueBlockersWorn}
              label="Wore blue light blockers"
            />
            <Toggle
              checked={wifiOff}
              onChange={setWifiOff}
              label="Turned off WiFi at night"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              type="time"
              label="Blue Blockers Start Time"
              value={blueBlockersTime}
              onChange={(e) => setBlueBlockersTime(e.target.value)}
            />
            <Input
              type="time"
              label="Phone Off Time"
              value={phoneOffTime}
              onChange={(e) => setPhoneOffTime(e.target.value)}
            />
            <Input
              type="time"
              label="Bedtime"
              value={bedtime}
              onChange={(e) => setBedtime(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="number"
              label="Hours of Darkness Exposure"
              value={darknessHours}
              onChange={(e) => setDarknessHours(e.target.value)}
              placeholder="e.g., 2"
              min="0"
              max="12"
              step="0.5"
            />
            <Input
              type="number"
              label="Hours of Sleep"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
              placeholder="e.g., 7.5"
              min="0"
              max="14"
              step="0.5"
            />
          </div>

          <RatingSlider
            value={sleepQuality}
            onChange={setSleepQuality}
            label="Sleep Quality"
            lowLabel="Poor"
            highLabel="Excellent"
          />

          <p className="text-xs text-neutral-500">
            Start wearing blue blockers 2-3 hours before bed. Aim for 7-9 hours of quality sleep.
          </p>
        </CardContent>
      </Card>

      {/* Subjective Wellness Section */}
      <Card className="border-neutral-200">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 rounded-xl bg-purple-100">
              <HugeiconsIcon icon={Clock01Icon} size={20} className="text-purple-600" />
            </div>
            How You Feel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RatingSlider
            value={energyLevel}
            onChange={setEnergyLevel}
            label="Energy Level Today"
            lowLabel="Exhausted"
            highLabel="Energized"
          />

          <Textarea
            label="Notes & Symptoms"
            value={symptomNotes}
            onChange={(e) => setSymptomNotes(e.target.value)}
            placeholder="How are you feeling? Any symptoms, wins, or observations..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-between pt-4">
        <p className="text-sm text-neutral-500">
          {existingEntry ? 'Updating' : 'Logging'} for {new Date(today).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <Button type="submit" disabled={isSaving} className="px-8">
          {isSaving ? (
            'Saving...'
          ) : (
            <>
              <HugeiconsIcon icon={Tick02Icon} size={18} className="mr-2" />
              {existingEntry ? 'Update' : 'Log'} Protocol
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
