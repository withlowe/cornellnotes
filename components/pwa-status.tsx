"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Wifi, WifiOff, Download } from "lucide-react"

export function PWAStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [isInstalled, setIsInstalled] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    // Check online status
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Check if installed as PWA
    const checkInstalled = () => {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      const isInWebAppiOS = (window.navigator as any).standalone === true
      setIsInstalled(isStandalone || isInWebAppiOS)
    }

    checkInstalled()

    // Listen for service worker updates
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        setUpdateAvailable(true)
      })
    }

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const handleUpdate = () => {
    window.location.reload()
  }

  return (
    <div className="flex items-center gap-2">
      {/* Online/Offline Status */}
      <Badge variant={isOnline ? "default" : "destructive"} className="gap-1 text-xs">
        {isOnline ? (
          <>
            <Wifi className="h-3 w-3" />
            Online
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            Offline
          </>
        )}
      </Badge>

      {/* PWA Installation Status */}
      {isInstalled && (
        <Badge variant="secondary" className="text-xs">
          Installed
        </Badge>
      )}

      {/* Update Available */}
      {updateAvailable && (
        <Badge variant="outline" className="gap-1 text-xs cursor-pointer hover:bg-accent" onClick={handleUpdate}>
          <Download className="h-3 w-3" />
          Update
        </Badge>
      )}
    </div>
  )
}
