
import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const MIN_EXTRACTED_CHARACTERS = 200

export interface CvExtractionResult {
  text: string
  needsManualInput: boolean
  message?: string
}

export async function extractCvText(
  file: File,
): Promise<CvExtractionResult> {
  const fileExtension = file.name.split('.').pop()?.toLowerCase()

  if (fileExtension === 'pdf') {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
    }).promise

    const pages: string[] = []

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()

      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')

      pages.push(pageText)
    }

    const text = pages.join('\n\n').trim()

    if (text.length < MIN_EXTRACTED_CHARACTERS) {
      return {
        text,
        needsManualInput: true,
        message:
          'We could not extract enough text. Your PDF may be scanned. Please paste your CV text instead.',
      }
    }

    return {
      text,
      needsManualInput: false,
    }
  }

  if (fileExtension === 'docx') {
    const arrayBuffer = await file.arrayBuffer()

    const result = await mammoth.extractRawText({
      arrayBuffer,
    })

    const text = result.value.trim()

    if (!text) {
      return {
        text: '',
        needsManualInput: true,
        message: 'No text could be extracted. Please paste your CV text.',
      }
    }

    return {
      text,
      needsManualInput: false,
    }
  }

  throw new Error('Unsupported file type. Please upload a PDF or DOCX file.')
}
