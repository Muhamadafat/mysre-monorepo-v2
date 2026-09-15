"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LoadingOverlay } from "@mantine/core"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

interface User {
  id: string
  email: string
  name: string
  role: "USER" | "ADMIN"
  token_balance?: number
  avatar_url?: string
}

export default function DashboardLayoutPage({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchUser = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/auth/signin", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })
      const data = await res.json()
      if (!data) {
        setUser(null)
        throw new Error("There is no user authenticated")
      } else {
        console.log(data)
        setUser(data.user)
      }
    } catch (error: any) {
      console.error(error.message)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = `${process.env.NEXT_PUBLIC_MAIN_APP_URL || "http://main.lvh.me:3000"}/signin`
    }
  }, [user, loading, router])

  if (loading) {
    return <LoadingOverlay visible />
  }

  if (!user) {
    return null
  }

  return <DashboardLayout user={user}>{children}</DashboardLayout>
}
