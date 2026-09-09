import { jsPDF } from 'jspdf'
import type { Memory, JournalEntry } from '@/lib/types'

interface ExportMemoryBookParams {
  userName: string
  partnerName: string
  spaceTitle?: string
  startDate: string
  daysTogether: number
  memories: Memory[]
  journalEntries: JournalEntry[]
}

// Helper to sanitize Turkish characters for jsPDF default Helvetica font
function cleanPdfText(str: string | null | undefined): string {
  if (!str) return ''
  // Strip html tags if any
  const stripped = str.replace(/<[^>]*>?/gm, '')
  return stripped
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 'S')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .trim()
}

async function getBase64ImageFromUrl(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        resolve(typeof reader.result === 'string' ? reader.result : null)
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function exportMemoryBookPDF({
  userName,
  partnerName,
  spaceTitle = 'Ortak Alan Anı Kitabı',
  startDate,
  daysTogether,
  memories,
  journalEntries,
}: ExportMemoryBookParams) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2

  let y = margin

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage()
      y = margin
      return true
    }
    return false
  }

  // ═══════════════════════════════════════════════════════════════
  // COVER / HEADER
  // ═══════════════════════════════════════════════════════════════
  // Decorative header box
  doc.setFillColor(255, 235, 242) // soft pink
  doc.roundedRect(margin, y, contentWidth, 55, 4, 4, 'F')

  doc.setTextColor(230, 57, 114) // primary pink
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  const titleText = cleanPdfText(spaceTitle)
  doc.text(titleText, pageWidth / 2, y + 18, { align: 'center' })

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 90)
  const namesText = `${cleanPdfText(userName)} & ${cleanPdfText(partnerName)}`
  doc.text(namesText, pageWidth / 2, y + 28, { align: 'center' })

  doc.setFontSize(11)
  doc.setTextColor(140, 140, 150)
  const counterText = `Birlikte gecen ${daysTogether} guzel gun | Baslangic: ${cleanPdfText(new Date(startDate).toLocaleDateString('tr-TR'))}`
  doc.text(counterText, pageWidth / 2, y + 38, { align: 'center' })

  doc.setFontSize(9)
  doc.setTextColor(180, 180, 190)
  doc.text(`Olusturuldu: ${new Date().toLocaleDateString('tr-TR')}`, pageWidth / 2, y + 47, { align: 'center' })

  y += 68

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1: FOTOĞRAF ANILARI (MEMORIES)
  // ═══════════════════════════════════════════════════════════════
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(230, 57, 114)
  doc.text(`Fotograf Anilari (${memories.length})`, margin, y)
  y += 10

  if (memories.length === 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(130, 130, 140)
    doc.text('Henuz kaydedilmis fotograf anisi bulunmuyor.', margin, y)
    y += 12
  } else {
    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i]
      checkPageBreak(75)

      // Card container
      doc.setFillColor(250, 250, 252)
      doc.setDrawColor(240, 220, 230)
      doc.roundedRect(margin, y, contentWidth, 68, 3, 3, 'FD')

      const imgWidth = 55
      const imgHeight = 55
      const imgX = margin + 6
      const imgY = y + 6.5

      // Try to load base64 image
      let hasImage = false
      if (memory.image_url) {
        try {
          const base64 = await getBase64ImageFromUrl(memory.image_url)
          if (base64) {
            doc.addImage(base64, 'JPEG', imgX, imgY, imgWidth, imgHeight)
            hasImage = true
          }
        } catch {
          hasImage = false
        }
      }

      if (!hasImage) {
        // Fallback placeholder box
        doc.setFillColor(240, 240, 245)
        doc.roundedRect(imgX, imgY, imgWidth, imgHeight, 2, 2, 'F')
        doc.setFontSize(9)
        doc.setTextColor(160, 160, 170)
        doc.text('[Fotograf]', imgX + imgWidth / 2, imgY + imgHeight / 2, { align: 'center' })
      }

      // Memory details on the right
      const textX = imgX + imgWidth + 8
      const textWidth = contentWidth - (imgWidth + 20)
      let textY = y + 16

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(50, 50, 60)
      const dateStr = cleanPdfText(new Date(memory.memory_date || memory.created_at).toLocaleDateString('tr-TR'))
      doc.text(`Tarih: ${dateStr}`, textX, textY)
      textY += 7

      if (memory.uploader?.full_name) {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(120, 120, 130)
        doc.text(`Ekleyen: ${cleanPdfText(memory.uploader.full_name)}`, textX, textY)
        textY += 8
      }

      if (memory.caption) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(70, 70, 80)
        const cleanCaption = cleanPdfText(memory.caption)
        const splitCaption = doc.splitTextToSize(`"${cleanCaption}"`, textWidth)
        doc.text(splitCaption, textX, textY)
      }

      y += 74
    }
  }

  y += 8
  checkPageBreak(40)

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2: GÜNLÜK YAZILARI (JOURNAL ENTRIES)
  // ═══════════════════════════════════════════════════════════════
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(230, 57, 114)
  doc.text(`Paylasilan Gunluk Yazilari (${journalEntries.length})`, margin, y)
  y += 10

  if (journalEntries.length === 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(130, 130, 140)
    doc.text('Henuz paylasilmis gunluk yazisi bulunmuyor.', margin, y)
    y += 12
  } else {
    for (let i = 0; i < journalEntries.length; i++) {
      const entry = journalEntries[i]
      const cleanTitle = cleanPdfText(entry.title || 'Gunluk Notu')
      const cleanAuthor = cleanPdfText(entry.author?.full_name || 'Ortak')
      const cleanDate = cleanPdfText(new Date(entry.entry_date || entry.created_at).toLocaleDateString('tr-TR'))
      const cleanContent = cleanPdfText(entry.content)

      const splitContent = doc.splitTextToSize(cleanContent, contentWidth - 16)
      const entryCardHeight = 28 + splitContent.length * 5

      checkPageBreak(Math.min(entryCardHeight, 60))

      doc.setFillColor(254, 250, 252)
      doc.setDrawColor(245, 225, 235)
      doc.roundedRect(margin, y, contentWidth, entryCardHeight, 3, 3, 'FD')

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(230, 57, 114)
      doc.text(cleanTitle, margin + 8, y + 9)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(130, 130, 140)
      doc.text(`${cleanDate} - ${cleanAuthor}`, margin + 8, y + 16)

      doc.setFontSize(10)
      doc.setTextColor(60, 60, 70)
      doc.text(splitContent, margin + 8, y + 24)

      y += entryCardHeight + 8
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FOOTER (PAGE NUMBERS)
  // ═══════════════════════════════════════════════════════════════
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(160, 160, 170)
    doc.text(`Starpie Ani Kitabi - Sayfa ${p} / ${totalPages}`, pageWidth / 2, pageHeight - 10, {
      align: 'center',
    })
  }

  // Save PDF
  const safeFileName = `Ani-Kitabi-${cleanPdfText(userName)}-${cleanPdfText(partnerName)}.pdf`.replace(/\s+/g, '-')
  doc.save(safeFileName)
}
