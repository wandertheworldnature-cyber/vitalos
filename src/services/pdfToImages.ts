// Converts PDF pages to base64 PNG images using PDF.js
// This lets us use Groq Vision (which handles images perfectly) for PDF lab reports

export async function pdfToImages(file: File): Promise<string[]> {
  // Dynamically import pdfjs to avoid bundling issues
  const pdfjsLib = await import('pdfjs-dist')
  
  // Set worker - use CDN to avoid build complexity  
  pdfjsLib.GlobalWorkerOptions.workerSrc = 
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  
  const images: string[] = []
  const totalPages = Math.min(pdf.numPages, 6) // Max 6 pages for lab reports
  
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    
    // Render at 2x scale for better OCR quality
    const scale = 2.0
    const viewport = page.getViewport({ scale })
    
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    
    // Convert to base64 PNG (remove the data:image/png;base64, prefix)
    const base64 = canvas.toDataURL('image/png').split(',')[1]
    images.push(base64)
  }
  
  return images
}
