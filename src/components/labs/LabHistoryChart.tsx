'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine } from 'recharts'

interface DataPoint {
  date: string
  value: number
  evaluation: string | null
}

interface ReferenceRange {
  min?: number | null
  max?: number | null
  optimalMin?: number | null
  optimalMax?: number | null
}

interface LabHistoryChartProps {
  data: DataPoint[]
  unit: string
  referenceRange?: ReferenceRange
  targetRange?: string // e.g., "<125" or "70-100"
}

export function LabHistoryChart({ data, unit, referenceRange, targetRange }: LabHistoryChartProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getEvaluationColor = (evaluation: string | null) => {
    switch (evaluation) {
      case 'normal':
        return '#22c55e'
      case 'low':
        return '#3b82f6'
      case 'moderate':
        return '#eab308'
      case 'high':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  // Custom dot that colors based on evaluation
  const CustomDot = (props: { cx?: number; cy?: number; payload?: DataPoint }) => {
    const { cx, cy, payload } = props
    if (!cx || !cy || !payload) return null

    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={getEvaluationColor(payload.evaluation)}
        stroke="#fff"
        strokeWidth={2}
      />
    )
  }

  // Calculate Y-axis domain to include reference ranges
  const allValues = data.map(d => d.value)
  const rangeValues = [
    referenceRange?.min,
    referenceRange?.max,
    referenceRange?.optimalMin,
    referenceRange?.optimalMax,
  ].filter((v): v is number => v !== null && v !== undefined)

  const allDataPoints = [...allValues, ...rangeValues]
  const minValue = Math.min(...allDataPoints) * 0.9
  const maxValue = Math.max(...allDataPoints) * 1.1

  // Determine if we should show reference ranges
  const hasReferenceRange = referenceRange && (referenceRange.min !== null || referenceRange.max !== null)
  const hasOptimalRange = referenceRange && (referenceRange.optimalMin !== null || referenceRange.optimalMax !== null)

  return (
    <div className="space-y-2">
      {/* Target range label */}
      {targetRange && (
        <div className="text-xs text-neutral-500 flex items-center gap-2">
          <span className="w-3 h-3 bg-green-100 border border-green-300 rounded" />
          <span>Target: {targetRange} {unit}</span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />

          {/* Reference range shaded area (normal range) */}
          {hasReferenceRange && referenceRange.min !== null && referenceRange.max !== null && (
            <ReferenceArea
              y1={referenceRange.min}
              y2={referenceRange.max}
              fill="#22c55e"
              fillOpacity={0.1}
              stroke="#22c55e"
              strokeOpacity={0.3}
              strokeDasharray="3 3"
            />
          )}

          {/* Optimal range shaded area (tighter optimal range) */}
          {hasOptimalRange && referenceRange.optimalMin !== null && referenceRange.optimalMax !== null && (
            <ReferenceArea
              y1={referenceRange.optimalMin}
              y2={referenceRange.optimalMax}
              fill="#22c55e"
              fillOpacity={0.15}
            />
          )}

          {/* Reference lines for min/max boundaries */}
          {hasReferenceRange && referenceRange.min !== null && (
            <ReferenceLine
              y={referenceRange.min}
              stroke="#22c55e"
              strokeDasharray="5 5"
              strokeOpacity={0.7}
              label={{ value: `Min: ${referenceRange.min}`, fill: '#22c55e', fontSize: 10, position: 'insideBottomLeft' }}
            />
          )}
          {hasReferenceRange && referenceRange.max !== null && (
            <ReferenceLine
              y={referenceRange.max}
              stroke="#22c55e"
              strokeDasharray="5 5"
              strokeOpacity={0.7}
              label={{ value: `Max: ${referenceRange.max}`, fill: '#22c55e', fontSize: 10, position: 'insideTopLeft' }}
            />
          )}

          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: '#737373' }}
            axisLine={{ stroke: '#e5e5e5' }}
          />
          <YAxis
            domain={[minValue, maxValue]}
            tick={{ fontSize: 11, fill: '#737373' }}
            axisLine={{ stroke: '#e5e5e5' }}
            label={{ value: unit, angle: -90, position: 'insideLeft', fontSize: 11, fill: '#737373' }}
          />
          <Tooltip
            labelFormatter={(label) => formatDate(label as string)}
            formatter={(value) => [typeof value === 'number' ? value.toFixed(2) : value, 'Value']}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#171717"
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 6, fill: '#171717' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
