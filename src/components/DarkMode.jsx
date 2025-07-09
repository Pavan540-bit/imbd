'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

const DarkMode = () => {
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // When mounted on client, setMounted to true so we can safely render theme-dependent UI
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null // Prevent hydration mismatch by not rendering theme-dependent UI on server

  // Use actual theme or system theme if theme === 'system'
  const currentTheme = theme === 'system' ? systemTheme : theme

  return (
    <button
      onClick={() =>
        setTheme(currentTheme === 'dark' ? 'light' : 'dark')
      }
      aria-label="Toggle Dark Mode"
      className="p-2 rounded border"
    >
      {currentTheme === 'dark' ? '🌞 Light Mode' : '🌙 Dark Mode'}
    </button>
  )
}

export default DarkMode
