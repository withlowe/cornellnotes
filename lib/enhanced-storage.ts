/**
 * Enhanced storage system with better error handling, data validation, and backup capabilities
 */

import { getAllImages, cleanupUnusedImages, importImages } from "./image-storage"

export interface DocumentData {
  id: string
  title: string
  summary?: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
  version: number
}

export interface StorageStats {
  totalDocuments: number
  totalImages: number
  storageUsed: number
  lastBackup?: string
  lastSync?: string
}

export interface BackupData {
  version: string
  timestamp: string
  documents: DocumentData[]
  images: Record<string, string>
  metadata: {
    totalDocuments: number
    totalImages: number
    exportedBy: string
  }
}

const STORAGE_VERSION = "1.0.0"
const STORAGE_KEYS = {
  DOCUMENTS: "cornell-notes-docs-v2",
  SETTINGS: "cornell-notes-settings",
  STATS: "cornell-notes-stats",
  LAST_BACKUP: "cornell-notes-last-backup",
} as const

// Storage quota management
export async function getStorageQuota(): Promise<{ used: number; quota: number; available: number }> {
  if ("storage" in navigator && "estimate" in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate()
      const used = estimate.usage || 0
      const quota = estimate.quota || 0
      const available = quota - used

      return { used, quota, available }
    } catch (error) {
      console.warn("Could not estimate storage:", error)
    }
  }

  // Fallback estimation
  const documentsSize = getStorageSize(STORAGE_KEYS.DOCUMENTS)
  const settingsSize = getStorageSize(STORAGE_KEYS.SETTINGS)
  const statsSize = getStorageSize(STORAGE_KEYS.STATS)

  const used = documentsSize + settingsSize + statsSize
  const quota = 50 * 1024 * 1024 // Assume 50MB quota as fallback

  return { used, quota, available: quota - used }
}

// Get size of a localStorage item
function getStorageSize(key: string): number {
  try {
    const item = localStorage.getItem(key)
    return item ? new Blob([item]).size : 0
  } catch {
    return 0
  }
}

// Enhanced document operations with validation
export function getAllDocuments(): DocumentData[] {
  if (typeof window === "undefined") return []

  try {
    const docs = localStorage.getItem(STORAGE_KEYS.DOCUMENTS)
    if (!docs) return []

    const parsed = JSON.parse(docs)

    // Validate and migrate documents if needed
    return Array.isArray(parsed) ? parsed.map(validateAndMigrateDocument).filter(Boolean) : []
  } catch (error) {
    console.error("Error loading documents:", error)

    // Try to recover from backup
    const backup = getLastBackup()
    if (backup && backup.documents) {
      console.log("Attempting to recover from backup...")
      try {
        localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(backup.documents))
        return backup.documents
      } catch (backupError) {
        console.error("Failed to recover from backup:", backupError)
      }
    }

    return []
  }
}

// Validate and migrate document structure
function validateAndMigrateDocument(doc: any): DocumentData | null {
  if (!doc || typeof doc !== "object") return null

  try {
    // Ensure required fields exist
    const migrated: DocumentData = {
      id: doc.id || Date.now().toString(),
      title: doc.title || "Untitled",
      summary: doc.summary || "",
      content: doc.content || "",
      tags: Array.isArray(doc.tags) ? doc.tags : [],
      createdAt: doc.createdAt || new Date().toISOString(),
      updatedAt: doc.updatedAt || doc.createdAt || new Date().toISOString(),
      version: doc.version || 1,
    }

    return migrated
  } catch (error) {
    console.error("Error migrating document:", error)
    return null
  }
}

// Get a single document by ID
export function getDocument(id: string): DocumentData | null {
  const docs = getAllDocuments()
  return docs.find((doc) => doc.id === id) || null
}

// Save a document with enhanced validation and versioning
export async function saveDocument(
  doc: Omit<DocumentData, "id" | "updatedAt" | "version"> & { id?: string },
): Promise<string> {
  try {
    const docs = getAllDocuments()
    const now = new Date().toISOString()

    let documentToSave: DocumentData

    if (doc.id) {
      // Update existing document
      const existingIndex = docs.findIndex((d) => d.id === doc.id)
      const existingDoc = existingIndex !== -1 ? docs[existingIndex] : null

      documentToSave = {
        ...doc,
        id: doc.id,
        updatedAt: now,
        version: existingDoc ? existingDoc.version + 1 : 1,
      } as DocumentData

      if (existingIndex !== -1) {
        docs[existingIndex] = documentToSave
      } else {
        docs.push(documentToSave)
      }
    } else {
      // Create new document
      const newId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      documentToSave = {
        ...doc,
        id: newId,
        updatedAt: now,
        version: 1,
      } as DocumentData

      docs.push(documentToSave)
    }

    // Save to localStorage with error handling
    try {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs))
    } catch (storageError) {
      // Handle quota exceeded
      if (storageError instanceof Error && storageError.name === "QuotaExceededError") {
        // Try to free up space
        await cleanupStorage()

        // Try again
        try {
          localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs))
        } catch (retryError) {
          throw new Error("Storage quota exceeded. Please delete some notes or images to free up space.")
        }
      } else {
        throw storageError
      }
    }

    // Update statistics
    updateStorageStats()

    return documentToSave.id
  } catch (error) {
    console.error("Error saving document:", error)
    throw new Error(`Failed to save document: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Delete a document by ID
export function deleteDocument(id: string): boolean {
  try {
    const docs = getAllDocuments()
    const filteredDocs = docs.filter((doc) => doc.id !== id)

    if (filteredDocs.length !== docs.length) {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(filteredDocs))
      updateStorageStats()
      return true
    }

    return false
  } catch (error) {
    console.error("Error deleting document:", error)
    return false
  }
}

// Enhanced backup and export functionality
export async function createFullBackup(): Promise<BackupData> {
  try {
    const documents = getAllDocuments()
    const images = await getAllImages()

    const backup: BackupData = {
      version: STORAGE_VERSION,
      timestamp: new Date().toISOString(),
      documents,
      images,
      metadata: {
        totalDocuments: documents.length,
        totalImages: Object.keys(images).length,
        exportedBy: "Cornell Notes PWA",
      },
    }

    // Store backup timestamp
    localStorage.setItem(STORAGE_KEYS.LAST_BACKUP, backup.timestamp)

    return backup
  } catch (error) {
    console.error("Error creating backup:", error)
    throw new Error("Failed to create backup")
  }
}

// Restore from backup
export async function restoreFromBackup(
  backupData: BackupData,
): Promise<{ documentsRestored: number; imagesRestored: number }> {
  try {
    // Validate backup data
    if (!backupData.documents || !Array.isArray(backupData.documents)) {
      throw new Error("Invalid backup data: missing or invalid documents")
    }

    // Restore documents
    const validDocuments = backupData.documents.map(validateAndMigrateDocument).filter(Boolean) as DocumentData[]
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(validDocuments))

    // Restore images
    let imagesRestored = 0
    if (backupData.images && typeof backupData.images === "object") {
      imagesRestored = await importImages(backupData.images)
    }

    // Update statistics
    updateStorageStats()

    return {
      documentsRestored: validDocuments.length,
      imagesRestored,
    }
  } catch (error) {
    console.error("Error restoring from backup:", error)
    throw new Error(`Failed to restore from backup: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Get last backup info
export function getLastBackup(): BackupData | null {
  try {
    const lastBackupTime = localStorage.getItem(STORAGE_KEYS.LAST_BACKUP)
    if (!lastBackupTime) return null

    // For now, return null since we don't store full backups locally
    // In a real app, you might store the last backup or retrieve it from a server
    return null
  } catch {
    return null
  }
}

// Storage cleanup utilities
export async function cleanupStorage(): Promise<{ deletedImages: number; freedSpace: number }> {
  try {
    const beforeSize = await getStorageQuota()

    // Clean up unused images
    const docs = getAllDocuments()
    const usedImageIds: string[] = []

    docs.forEach((doc) => {
      const imageMatches = doc.content.match(/cornell-image:\/\/(.*?)["']/g)
      if (imageMatches) {
        imageMatches.forEach((match) => {
          const id = match.replace(/cornell-image:\/\//, "").replace(/["']/, "")
          if (id) usedImageIds.push(id)
        })
      }
    })

    const deletedImages = await cleanupUnusedImages([...new Set(usedImageIds)])

    const afterSize = await getStorageQuota()
    const freedSpace = beforeSize.used - afterSize.used

    updateStorageStats()

    return { deletedImages, freedSpace }
  } catch (error) {
    console.error("Error during cleanup:", error)
    return { deletedImages: 0, freedSpace: 0 }
  }
}

// Storage statistics
export async function getStorageStats(): Promise<StorageStats> {
  try {
    const documents = getAllDocuments()
    const images = await getAllImages()
    const quota = await getStorageQuota()
    const lastBackup = localStorage.getItem(STORAGE_KEYS.LAST_BACKUP)

    return {
      totalDocuments: documents.length,
      totalImages: Object.keys(images).length,
      storageUsed: quota.used,
      lastBackup: lastBackup || undefined,
    }
  } catch (error) {
    console.error("Error getting storage stats:", error)
    return {
      totalDocuments: 0,
      totalImages: 0,
      storageUsed: 0,
    }
  }
}

// Update storage statistics
function updateStorageStats(): void {
  try {
    const stats = {
      lastUpdated: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats))
  } catch (error) {
    console.error("Error updating storage stats:", error)
  }
}

// Search functionality
export function searchDocuments(query: string, tags: string[] = []): DocumentData[] {
  const documents = getAllDocuments()

  if (!query.trim() && tags.length === 0) {
    return documents
  }

  const searchTerm = query.toLowerCase().trim()

  return documents.filter((doc) => {
    // Text search
    const titleMatch = doc.title.toLowerCase().includes(searchTerm)
    const summaryMatch = doc.summary?.toLowerCase().includes(searchTerm) || false
    const contentMatch = doc.content.toLowerCase().includes(searchTerm)
    const tagMatch = doc.tags.some((tag) => tag.toLowerCase().includes(searchTerm))

    const textMatch = !searchTerm || titleMatch || summaryMatch || contentMatch || tagMatch

    // Tag filter
    const tagFilter = tags.length === 0 || tags.every((tag) => doc.tags.includes(tag))

    return textMatch && tagFilter
  })
}

// Export functions for backward compatibility
// Remove the problematic export line at the bottom:
// export { cleanupImages }
