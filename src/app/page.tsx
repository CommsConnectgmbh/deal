'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function RootPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (user) {
      router.replace('/app/home')
    } else {
      const done = localStorage.getItem('onboarding_complete')
      router.replace(done ? '/auth/login' : '/onboarding')
    }
  }, [user, loading, router])

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:'#060606' }}>
      <div style={{ width:40, height:40, border:'2px solid transparent', borderTopColor:'#FFB800', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
