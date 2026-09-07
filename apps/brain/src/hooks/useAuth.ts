"use client"

import { useState, useEffect } from "react"

interface User {
  id: string
  email: string
  name: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/auth/session", { credentials: "include" })
      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email,
            name: data.user.name || data.user.email?.split("@")[0] || "Unknown",
          })
        } else {
          setUser(null)
        }
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error("useAuth fetchUser error:", error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST", credentials: "include" })
      setUser(null)

      const loginUrl = `${process.env.NEXT_PUBLIC_MAIN_APP_URL || "http://main.lvh.me:3000"}/signin`
      window.location.href = loginUrl
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  return {
    user,
    loading,
    signOut,
    refreshUser: fetchUser,
    isAuthenticated: !!user,
  }
}
