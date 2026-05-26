'use client'
import { useEffect, useState } from 'react'

const TIME_ZONES = [
  'UTC',
  'Europe/Moscow',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Dubai',
]

const NOTIFICATION_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'important_only', label: 'Important only' },
  { value: 'off', label: 'Off' },
]

type Profile = {
  displayName: string
  email: string
  phone: string | null
  signature: string | null
  timeZone: string
  notifications: string
}

type Errors = Partial<Record<keyof Profile, string>>

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data: Profile) => {
        if (!cancelled) {
          setProfile(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ type: 'err', text: 'Failed to load profile.' })
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setStatus(null)
    setErrors({})
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: profile.displayName,
          phone: profile.phone ?? '',
          signature: profile.signature ?? '',
          timeZone: profile.timeZone,
          notifications: profile.notifications,
        }),
      })
      const data = (await res.json()) as Profile | { errors: Errors }
      if (res.ok) {
        setProfile(data as Profile)
        setStatus({ type: 'ok', text: 'Profile saved.' })
      } else {
        setErrors((data as { errors: Errors }).errors ?? {})
        setStatus({ type: 'err', text: 'Please fix the errors below.' })
      }
    } catch {
      setStatus({ type: 'err', text: 'Network error. Please try again.' })
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="p-6 max-w-2xl mx-auto text-sm text-gray-500">Loading…</div>
  }
  if (!profile) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-sm text-red-600">
        Failed to load profile.
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Profile</h1>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <form onSubmit={handleSubmit} className="divide-y divide-gray-100">
          <Field label="Display name" error={errors.displayName}>
            <input
              type="text"
              name="displayName"
              value={profile.displayName}
              onChange={(e) => set('displayName', e.target.value)}
              className="w-full text-sm outline-none placeholder-gray-300"
              placeholder="Your name"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              name="email"
              value={profile.email}
              readOnly
              disabled
              className="w-full text-sm outline-none text-gray-500 bg-transparent"
            />
          </Field>

          <Field label="Phone" error={errors.phone}>
            <input
              type="tel"
              name="phone"
              value={profile.phone ?? ''}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+1 555 123 4567"
              className="w-full text-sm outline-none placeholder-gray-300"
            />
          </Field>

          <Field label="Signature" error={errors.signature}>
            <textarea
              name="signature"
              value={profile.signature ?? ''}
              onChange={(e) => set('signature', e.target.value)}
              rows={4}
              placeholder="Sent from MailLab"
              className="w-full text-sm outline-none resize-none placeholder-gray-300"
            />
          </Field>

          <Field label="Time zone" error={errors.timeZone}>
            <select
              name="timeZone"
              value={profile.timeZone}
              onChange={(e) => set('timeZone', e.target.value)}
              className="w-full text-sm outline-none bg-transparent"
            >
              {TIME_ZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notifications" error={errors.notifications}>
            <select
              name="notifications"
              value={profile.notifications}
              onChange={(e) => set('notifications', e.target.value)}
              className="w-full text-sm outline-none bg-transparent"
            >
              {NOTIFICATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex items-center justify-end px-4 py-3 bg-gray-50">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
      {status && (
        <p
          role="status"
          className={`mt-3 text-sm ${status.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}
        >
          {status.text}
        </p>
      )}
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="px-4 py-3">
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
