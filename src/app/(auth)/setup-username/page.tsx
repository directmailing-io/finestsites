'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// This page is replaced by /onboarding/username
// Redirect existing users who land here
export default function SetupUsernameLegacyPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/onboarding/username')
  }, [router])
  return null
}
