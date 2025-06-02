import { getAllImages, cleanupUnusedImages } from "./image-storage"
import {
  getAllDocuments as getEnhancedDocuments,
  saveDocument as saveEnhancedDocument,
  deleteDocument as deleteEnhancedDocument,
  type DocumentData,
} from "./enhanced-storage"

// Re-export the enhanced storage functions for backward compatibility
export type { DocumentData } from "./enhanced-storage"

export function getAllDocuments(): DocumentData[] {
  return getEnhancedDocuments()
}

export function getDocument(id: string): DocumentData | null {
  const docs = getAllDocuments()
  return docs.find((doc) => doc.id === id) || null
}

export async function saveDocument(
  doc: Omit<DocumentData, "id" | "updatedAt" | "version"> & { id?: string },
): Promise<string> {
  return await saveEnhancedDocument(doc)
}

export function deleteDocument(id: string): boolean {
  return deleteEnhancedDocument(id)
}

// Extract all image IDs from content
function extractImageIds(content: string): string[] {
  const imageIds: string[] = []
  const regex = /cornell-image:\/\/(.*?)["']/g
  let match

  while ((match = regex.exec(content)) !== null) {
    if (match[1]) {
      imageIds.push(match[1])
    }
  }

  return imageIds
}

// Clean up unused images - now uses the enhanced storage cleanup
export async function cleanupImages(): Promise<number> {
  try {
    // Get all documents
    const docs = getAllDocuments()

    // Extract all image IDs from all documents
    const usedImageIds: string[] = []
    docs.forEach((doc) => {
      const ids = extractImageIds(doc.content)
      usedImageIds.push(...ids)
    })

    // Remove duplicates
    const uniqueImageIds = [...new Set(usedImageIds)]

    // Clean up unused images
    const deletedCount = await cleanupUnusedImages(uniqueImageIds)

    return deletedCount
  } catch (error) {
    console.error("Error cleaning up images:", error)
    return 0
  }
}

// Export all documents and images
export async function exportAllData(): Promise<string> {
  try {
    const docs = getAllDocuments()
    const images = await getAllImages()

    const exportData = {
      documents: docs,
      images,
    }

    return JSON.stringify(exportData)
  } catch (error) {
    console.error("Error exporting data:", error)
    throw new Error("Failed to export data")
  }
}
