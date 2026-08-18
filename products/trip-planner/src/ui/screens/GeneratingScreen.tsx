import { useEffect, useState } from 'react'
import type { OriginCity } from '../../domain/types'
import { Icon } from '../components/Icon'

/**
 * S4 — Generating (docs/03-design.md §4 S4).
 *
 * This screen exists to name the work, not to fake it. The engine finishes in well
 * under a millisecond; the beat is here so the status line is readable, and it is
 * capped so it can never become a wait (R7).
 */

const STEP_MS = 300

export interface GeneratingScreenProps {
  origin: OriginCity
  destinationCount: number
}

export function GeneratingScreen({ origin, destinationCount }: GeneratingScreenProps) {
  const steps = [
    `Scoring ${destinationCount} destinations against your answers`,
    `Pricing flights from ${origin}`,
    'Building your day-by-day',
  ]
  const [step, setStep] = useState(0)

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStep(1), STEP_MS),
      window.setTimeout(() => setStep(2), STEP_MS * 2),
    ]
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [])

  return (
    <div className="screen screen--form screen--narrow generating">
      <Icon name="star" size={40} className="generating__glyph" />
      <h1 className="screen__title" tabIndex={-1}>
        Planning your trip
      </h1>
      <p className="generating__status" role="status" aria-live="polite">
        {steps[step] ?? steps[0]}
      </p>
      <div
        className="progress__track generating__bar"
        role="progressbar"
        aria-label="Planning progress"
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress__fill generating__fill" />
      </div>
      <p className="generating__sub">
        This runs on your device &mdash; nothing is sent anywhere.
      </p>
    </div>
  )
}
