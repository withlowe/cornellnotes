"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, X, Smartphone, Monitor } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform: string
  }>
  prompt(): Promise<void>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if app is already installed
    const checkInstalled = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches
      const isInWebAppiOS = (window.navigator as any).standalone === true
      setIsStandalone(standalone || isInWebAppiOS)
      setIsInstalled(standalone || isInWebAppiOS)
    }

    // Check if iOS
    const checkIOS = () => {
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
      setIsIOS(isIOSDevice)
    }

    checkInstalled()
    checkIOS()

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)

      // Show prompt after a delay if not already installed
      setTimeout(() => {
        if (!isInstalled) {
          setShowPrompt(true)
        }
      }, 3000)
    }

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowPrompt(false)
      setDeferredPrompt(null)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [isInstalled])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === "accepted") {
        setIsInstalled(true)
      }

      setShowPrompt(false)
      setDeferredPrompt(null)
    } catch (error) {
      console.error("Error during installation:", error)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // Don't show again for this session
    sessionStorage.setItem("pwa-prompt-dismissed", "true")
  }

  // Don't show if already installed or dismissed this session
  if (isInstalled || isStandalone || sessionStorage.getItem("pwa-prompt-dismissed")) {
    return null
  }

  // Don't show if no install prompt available and not iOS
  if (!deferredPrompt && !isIOS) {
    return null
  }

  if (!showPrompt) return null

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 shadow-lg border-2 md:left-auto md:right-4 md:w-96">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              {isIOS ? <Smartphone className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            </div>
            <div>
              <CardTitle className="text-lg">Install Cornell Notes</CardTitle>
              <CardDescription className="text-sm">Get the full app experience with offline access</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleDismiss} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <ul className="space-y-1">
              <li>• Work offline without internet</li>
              <li>• Faster loading and performance</li>
              <li>• Native app-like experience</li>
              <li>• Quick access from home screen</li>
            </ul>
          </div>

          {isIOS ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">To install on iOS:</p>
              <ol className="text-sm text-muted-foreground space-y-1">
                <li>1. Tap the Share button in Safari</li>
                <li>2. Scroll down and tap "Add to Home Screen"</li>
                <li>3. Tap "Add" to confirm</li>
              </ol>
            </div>
          ) : (
            <Button onClick={handleInstallClick} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Install App
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
