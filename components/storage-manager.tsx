"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  getStorageStats,
  getStorageQuota,
  cleanupStorage,
  createFullBackup,
  restoreFromBackup,
  type StorageStats,
  type BackupData,
} from "@/lib/enhanced-storage"
import {
  HardDrive,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  FileText,
  ImageIcon,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"

interface StorageManagerProps {
  isOpen: boolean
  onClose: () => void
}

export function StorageManager({ isOpen, onClose }: StorageManagerProps) {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [quota, setQuota] = useState<{ used: number; quota: number; available: number } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  const loadStorageInfo = async () => {
    setIsLoading(true)
    try {
      const [storageStats, quotaInfo] = await Promise.all([getStorageStats(), getStorageQuota()])
      setStats(storageStats)
      setQuota(quotaInfo)
    } catch (error) {
      console.error("Error loading storage info:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadStorageInfo()
    }
  }, [isOpen])

  const handleCleanup = async () => {
    setIsCleaningUp(true)
    try {
      const result = await cleanupStorage()
      await loadStorageInfo() // Refresh data
      alert(
        `Cleanup completed!\nDeleted ${result.deletedImages} unused images\nFreed ${formatBytes(result.freedSpace)} of space`,
      )
    } catch (error) {
      console.error("Cleanup failed:", error)
      alert("Cleanup failed. Please try again.")
    } finally {
      setIsCleaningUp(false)
    }
  }

  const handleBackup = async () => {
    setIsBackingUp(true)
    try {
      const backup = await createFullBackup()

      // Download backup as JSON file
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `cornell-notes-backup-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      await loadStorageInfo() // Refresh data
      alert("Backup created and downloaded successfully!")
    } catch (error) {
      console.error("Backup failed:", error)
      alert("Backup failed. Please try again.")
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleRestore = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      setIsRestoring(true)
      try {
        const text = await file.text()
        const backupData: BackupData = JSON.parse(text)

        const confirmed = confirm(
          `This will restore ${backupData.metadata.totalDocuments} documents and ${backupData.metadata.totalImages} images.\n\nThis will overwrite your current data. Are you sure?`,
        )

        if (!confirmed) return

        const result = await restoreFromBackup(backupData)
        await loadStorageInfo() // Refresh data
        alert(`Restore completed!\nRestored ${result.documentsRestored} documents and ${result.imagesRestored} images`)
      } catch (error) {
        console.error("Restore failed:", error)
        alert("Restore failed. Please check the backup file and try again.")
      } finally {
        setIsRestoring(false)
      }
    }
    input.click()
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getStorageStatus = (): { color: string; icon: React.ReactNode; message: string } => {
    if (!quota) return { color: "gray", icon: <HardDrive className="h-4 w-4" />, message: "Loading..." }

    const usagePercent = (quota.used / quota.quota) * 100

    if (usagePercent > 90) {
      return {
        color: "red",
        icon: <AlertTriangle className="h-4 w-4" />,
        message: "Storage almost full",
      }
    } else if (usagePercent > 70) {
      return {
        color: "yellow",
        icon: <AlertTriangle className="h-4 w-4" />,
        message: "Storage getting full",
      }
    } else {
      return {
        color: "green",
        icon: <CheckCircle className="h-4 w-4" />,
        message: "Storage healthy",
      }
    }
  }

  if (!isOpen) return null

  const storageStatus = getStorageStatus()
  const usagePercent = quota ? (quota.used / quota.quota) * 100 : 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Storage Manager
              </CardTitle>
              <CardDescription>Manage your local storage, backups, and data</CardDescription>
            </div>
            <Button variant="ghost" onClick={onClose}>
              ×
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Storage Overview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Storage Usage</h3>
              <Badge variant={storageStatus.color === "red" ? "destructive" : "secondary"} className="gap-1">
                {storageStatus.icon}
                {storageStatus.message}
              </Badge>
            </div>

            {quota && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Used: {formatBytes(quota.used)}</span>
                  <span>Available: {formatBytes(quota.available)}</span>
                </div>
                <Progress value={usagePercent} className="h-2" />
                <div className="text-xs text-muted-foreground text-center">
                  {usagePercent.toFixed(1)}% of {formatBytes(quota.quota)} used
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Data Statistics */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Data Overview</h3>

            {stats && (
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                    <div className="text-2xl font-bold">{stats.totalDocuments}</div>
                    <div className="text-sm text-muted-foreground">Documents</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <div className="text-2xl font-bold">{stats.totalImages}</div>
                    <div className="text-sm text-muted-foreground">Images</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {stats?.lastBackup && (
              <div className="text-sm text-muted-foreground">
                Last backup: {new Date(stats.lastBackup).toLocaleDateString()}
              </div>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Actions</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button onClick={handleCleanup} disabled={isCleaningUp || isLoading} variant="outline" className="gap-2">
                {isCleaningUp ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {isCleaningUp ? "Cleaning..." : "Cleanup Storage"}
              </Button>

              <Button onClick={loadStorageInfo} disabled={isLoading} variant="outline" className="gap-2">
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </Button>

              <Button onClick={handleBackup} disabled={isBackingUp || isLoading} variant="outline" className="gap-2">
                {isBackingUp ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isBackingUp ? "Creating..." : "Create Backup"}
              </Button>

              <Button onClick={handleRestore} disabled={isRestoring || isLoading} variant="outline" className="gap-2">
                {isRestoring ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isRestoring ? "Restoring..." : "Restore Backup"}
              </Button>
            </div>
          </div>

          {/* Storage Tips */}
          <div className="bg-muted/30 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Storage Tips</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Regular cleanup removes unused images and frees space</li>
              <li>• Create backups before major changes</li>
              <li>• Large images use more storage - consider compressing them</li>
              <li>• The app works offline once installed as a PWA</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
