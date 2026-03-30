// composables/useImageUpload.ts
import imageCompression from 'browser-image-compression'

export function useImageUpload() {
  const supabase = useSupabaseClient()
  const isUploading = ref(false)

  const compressionOptions = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    fileType: 'image/jpeg' as const,
  }

  /**
   * Compress an image file
   */
  async function compressImage(file: File): Promise<File> {
    try {
      return await imageCompression(file, compressionOptions)
    }
    catch {
      return file
    }
  }

  /**
   * Upload a single image to Supabase Storage
   */
  async function uploadImage(
    file: File,
    folder: string = 'visites'
  ): Promise<string | null> {
    isUploading.value = true

    try {
      const compressed = await compressImage(file)
      const ext = 'jpg'
      const fileName = `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`

      const { data, error } = await supabase.storage
        .from('visite-images')
        .upload(fileName, compressed, {
          contentType: 'image/jpeg',
          upsert: false,
        })

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('visite-images')
        .getPublicUrl(data.path)

      return urlData.publicUrl
    }
    catch (err) {
      console.error('Erreur upload image:', err)
      return null
    }
    finally {
      isUploading.value = false
    }
  }

  /**
   * Upload multiple images
   */
  async function uploadImages(
    files: File[],
    folder: string = 'visites'
  ): Promise<string[]> {
    const urls: string[] = []
    for (const file of files) {
      const url = await uploadImage(file, folder)
      if (url) urls.push(url)
    }
    return urls
  }

  /**
   * Capture photo from camera
   */
  function capturePhoto(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.capture = 'environment'

      input.onchange = (e: Event) => {
        const target = e.target as HTMLInputElement
        const file = target.files?.[0] || null
        resolve(file)
      }

      input.oncancel = () => resolve(null)
      input.click()
    })
  }

  return {
    isUploading,
    compressImage,
    uploadImage,
    uploadImages,
    capturePhoto,
  }
}
