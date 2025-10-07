"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { PdfLoader, PdfHighlighter, Highlight, Popup, AreaHighlight } from "react-pdf-highlighter"
import type { Content, IHighlight, NewHighlight, ScaledPosition } from "react-pdf-highlighter"
import {
  Button,
  Group,
  Card,
  Text,
  ScrollArea,
  Title,
  Divider,
  Stack,
  useMantineColorScheme,
  useMantineTheme,
  ActionIcon,
  Loader,
} from "@mantine/core"
import { IconTrash, IconDownload } from "@tabler/icons-react"
import "react-pdf-highlighter/dist/style.css"
import { useXapiTracking } from "@/hooks/useXapiTracking"
import { PDFDocument, rgb } from "pdf-lib"

interface WebViewerProps {
  fileUrl: string
  onAnalytics?: (data: any) => void
  session?: any
  articleId?: string
}

interface AnnotationFromAPI {
  id: string
  page: number
  highlightedText: string
  comment: string
  articleId: string
  userId: string
  createdAt: string
  semanticTag?: string // ✅ Gunakan semanticTag untuk menyimpan positionData
  article: {
    id: string
    title: string
    filePath: string
    sessionId?: string
  }
}

const WebViewer: React.FC<WebViewerProps> = ({ fileUrl, onAnalytics, session, articleId }) => {
  const [highlights, setHighlights] = useState<IHighlight[]>([])
  const [isLoadingAnnotations, setIsLoadingAnnotations] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const scrollViewerTo = useRef<(highlight: IHighlight) => void>(() => {})

  const { colorScheme } = useMantineColorScheme()
  const theme = useMantineTheme()
  const isDark = colorScheme === "dark"

  const { trackTextSelection, trackAnnotationAttempt, trackAnnotationSave } = useXapiTracking(session)

  // ✅ FIX: Load annotations dengan dependency yang lebih spesifik
  useEffect(() => {
    const loadAnnotations = async () => {
      // ✅ Debug: Log seluruh session object untuk lihat strukturnya
      console.log('🔍 Full session object:', JSON.stringify(session, null, 2))
      
      // ✅ FIXED: Prioritaskan projectId dulu (ini brainstorming session ID yang benar)
      const sessionId = session?.projectId || session?.sessionId || session?.id
      
      console.log('🎬 Load annotations useEffect triggered', { 
        sessionId, 
        fileUrl,
        sessionObject: session,
        hasSession: !!session,
        sessionKeys: session ? Object.keys(session) : [],
        extractedIds: {
          projectId: session?.projectId,
          sessionId: session?.sessionId,
          id: session?.id,
          userId: session?.user?.id,
        }
      })
      
      // ✅ Jika tidak ada session, tunggu dulu
      if (!session) {
        console.log('⏳ Session not ready yet, waiting...')
        setIsLoadingAnnotations(true)
        return
      }
      
      if (!sessionId) {
        console.log('❌ No session ID found in session object')
        console.log('❌ Available keys:', Object.keys(session))
        console.log('❌ Session values:', session)
        setIsLoadingAnnotations(false)
        return
      }

      try {
        const apiUrl = `/api/annotation?sessionId=${sessionId}`
        console.log('🔍 Loading annotations from:', apiUrl)
        console.log('📤 Request sessionId:', sessionId)
        
        const response = await fetch(apiUrl)
        
        console.log('📡 API Response status:', response.status)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('❌ API Error:', response.status, errorText)
          throw new Error('Failed to load annotations')
        }

        const annotations: AnnotationFromAPI[] = await response.json()
        console.log('📦 Loaded annotations from API:', annotations.length, annotations)
        
        // Filter annotations for current document
        const currentDocAnnotations = annotations.filter(ann => {
          if (!ann.article?.filePath) {
            console.log('⚠️ Annotation missing filePath:', ann.id)
            return false
          }
          
          const normalizeUrl = (url: string) => url.toLowerCase().trim()
          const normalizedFilePath = normalizeUrl(ann.article.filePath)
          const normalizedFileUrl = normalizeUrl(fileUrl)
          
          const isMatch = normalizedFilePath === normalizedFileUrl || 
                 normalizedFileUrl.includes(normalizedFilePath) ||
                 normalizedFilePath.includes(normalizedFileUrl)
          
          console.log('🔎 Checking annotation:', {
            annotationId: ann.id,
            filePath: ann.article.filePath,
            fileUrl: fileUrl,
            isMatch
          })
          
          return isMatch
        })

        console.log('✅ Filtered annotations for current document:', currentDocAnnotations.length)

        // ✅ Convert API annotations to IHighlight format (ambil dari semanticTag)
        const loadedHighlights: IHighlight[] = currentDocAnnotations
          .map(ann => {
            try {
              // ✅ positionData sekarang ada di semanticTag field
              const position = ann.semanticTag 
                ? JSON.parse(ann.semanticTag)
                : {
                    pageNumber: ann.page,
                    boundingRect: { x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0 },
                    rects: [],
                  }

              const highlight: IHighlight = {
                id: ann.id,
                content: { text: ann.highlightedText || '' },
                position,
                comment: {
                  text: ann.comment || '',
                  emoji: '',
                },
              }
              
              console.log('✅ Parsed highlight:', {
                id: ann.id,
                page: ann.page,
                hasPosition: !!ann.semanticTag,
                position: position
              })
              
              return highlight
            } catch (error) {
              console.error('❌ Error parsing annotation position:', error, ann)
              return null
            }
          })
          .filter((h): h is IHighlight => h !== null)

        console.log('✨ Loaded highlights:', loadedHighlights.length, loadedHighlights)
        setHighlights(loadedHighlights)
      } catch (error) {
        console.error('❌ Error loading annotations:', error)
      } finally {
        setIsLoadingAnnotations(false)
      }
    }

    loadAnnotations()
  }, [session, fileUrl]) // ✅ Dependency yang benar

  const parseIdFromHash = () => document.location.hash.replace(/^#highlight-/, "")
  const resetHash = () => {
    document.location.hash = ""
  }

  const scrollToHighlightFromHash = useCallback(() => {
    const highlight = highlights.find((h) => h.id === parseIdFromHash())
    if (highlight) {
      scrollViewerTo.current(highlight)
    }
  }, [highlights])

  useEffect(() => {
    window.addEventListener("hashchange", scrollToHighlightFromHash)
    return () => {
      window.removeEventListener("hashchange", scrollToHighlightFromHash)
    }
  }, [scrollToHighlightFromHash])

  const addHighlight = async (highlight: NewHighlight) => {
  const highlightedText = typeof highlight.content === "string" ? highlight.content : highlight.content?.text || ""
  const commentText = highlight.comment?.text || ""
  const sanitizedComment = {
    text: commentText.replace(/[\u{1F300}-\u{1F9FF}]/gu, "").trim(),
    emoji: "",
  }

  // ✅ Track selection (tidak POST annotation)
  trackTextSelection(highlightedText, `PDF document: ${fileUrl}`)

  const tempId = Math.random().toString(36).slice(2)
  
  const tempHighlight: IHighlight = {
    id: tempId,
    content: highlight.content,
    position: highlight.position,
    comment: sanitizedComment,
  }
  
  setHighlights((prev) => [tempHighlight, ...prev])

  try {
    console.log('💾 Saving annotation to API...')
    
    // ✅ HANYA 1 POST REQUEST KE /api/annotation
    const response = await fetch('/api/annotation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: "annotation_add",
        document: fileUrl,
        metadata: {
          annotationType: "Highlight",
          contents: sanitizedComment.text,
          highlightedText,
          pageNumber: highlight.position.pageNumber,
          rect: highlight.position.boundingRect,
          positionData: JSON.stringify(highlight.position),
        },
        timeStamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API Error:', response.status, errorText)
      throw new Error(`Failed to save annotation: ${errorText}`)
    }

    const savedAnnotation = await response.json()
    console.log('✅ Annotation saved to API:', savedAnnotation)

    setHighlights((prev) => 
      prev.map(h => h.id === tempId ? { ...h, id: savedAnnotation.id } : h)
    )

    // ✅ Analytics hanya untuk logging, tidak POST annotation
    onAnalytics?.({
      action: "annotation_add",
      document: fileUrl,
      metadata: {
        annotationType: "Highlight",
        contents: sanitizedComment.text,
        highlightedText,
        pageNumber: highlight.position.pageNumber,
        annotationId: savedAnnotation.id,
      },
      timeStamp: new Date().toISOString(),
    })

    // ✅ xAPI tracking hanya untuk logging, tidak POST annotation
    trackAnnotationSave(highlightedText, sanitizedComment.text, fileUrl)
    
  } catch (error) {
    console.error('❌ Error saving annotation to API:', error)
  }
}

  const deleteHighlight = async (highlightId: string) => {
    try {
      const response = await fetch(`/api/annotation/${highlightId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete annotation')

      setHighlights((prev) => prev.filter((h) => h.id !== highlightId))

      onAnalytics?.({
        action: "annotation_delete",
        document: fileUrl,
        metadata: {
          annotationId: highlightId,
        },
        timeStamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error deleting annotation:', error)
    }
  }

  const updateHighlight = (highlightId: string, position: Partial<ScaledPosition>, content: Partial<Content>) => {
    setHighlights((prev) =>
      prev.map((h) =>
        h.id === highlightId
          ? {
              ...h,
              position: { ...h.position, ...position },
              content: { ...h.content, ...content },
            }
          : h,
      ),
    )
  }

  // const handleDownloadWithHighlights = async () => {
  //   setIsDownloading(true)
  //   try {
  //     const existingPdfBytes = await fetch(fileUrl).then(res => res.arrayBuffer())
  //     const pdfDoc = await PDFDocument.load(existingPdfBytes)

  //     const pages = pdfDoc.getPages()
      
  //     highlights.forEach(highlight => {
  //       const pageIndex = highlight.position.pageNumber - 1
  //       if (pageIndex >= 0 && pageIndex < pages.length) {
  //         const page = pages[pageIndex]
  //         const { height } = page.getSize()
          
  //         if (highlight.position.boundingRect) {
  //           const rect = highlight.position.boundingRect
  //           page.drawRectangle({
  //             x: rect.x1,
  //             y: height - rect.y2,
  //             width: rect.width,
  //             height: rect.height,
  //             color: rgb(1, 1, 0),
  //             opacity: 0.3,
  //           })
  //         }

  //         if (highlight.comment?.text) {
  //           const text = highlight.comment.text
  //           const rect = highlight.position.boundingRect
            
  //           page.drawText(text, {
  //             x: rect.x1 + 5,
  //             y: height - rect.y1 - 15,
  //             size: 10,
  //             color: rgb(1, 0, 0),
  //           })
  //         }
  //       }
  //     })

  //     const pdfBytes = await pdfDoc.save()
  //     const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
  //     const url = window.URL.createObjectURL(blob)
  //     const link = document.createElement('a')
  //     link.href = url
  //     link.download = `${fileUrl.split('/').pop()?.replace('.pdf', '')}_highlighted.pdf` || 'document_highlighted.pdf'
  //     document.body.appendChild(link)
  //     link.click()
  //     document.body.removeChild(link)
  //     window.URL.revokeObjectURL(url)

  //     onAnalytics?.({
  //       action: "document_downloaded_with_highlights",
  //       document: fileUrl,
  //       highlightCount: highlights.length,
  //       timeStamp: new Date().toISOString(),
  //     })
  //   } catch (error) {
  //     console.error('Error downloading PDF with highlights:', error)
  //     const link = document.createElement('a')
  //     link.href = fileUrl
  //     link.download = fileUrl.split('/').pop() || 'document.pdf'
  //     document.body.appendChild(link)
  //     link.click()
  //     document.body.removeChild(link)
  //   } finally {
  //     setIsDownloading(false)
  //   }
  // }
  const handleDownloadWithHighlights = async () => {
  setIsDownloading(true)
  try {
    const existingPdfBytes = await fetch(fileUrl).then(res => res.arrayBuffer())
    const pdfDoc = await PDFDocument.load(existingPdfBytes)

    const pages = pdfDoc.getPages()
    
    highlights.forEach(highlight => {
      const pageIndex = highlight.position.pageNumber - 1
      if (pageIndex >= 0 && pageIndex < pages.length) {
        const page = pages[pageIndex]
        const { width: pdfPageWidth, height: pdfPageHeight } = page.getSize()
        
        console.log('🎨 Processing highlight:', {
          page: highlight.position.pageNumber,
          position: highlight.position,
          pdfPageSize: { width: pdfPageWidth, height: pdfPageHeight }
        })
        
        // ✅ Get viewport dimensions from position (ini adalah dimensi saat di-render di browser)
        const viewportWidth = highlight.position.boundingRect?.width || pdfPageWidth
        const viewportHeight = highlight.position.boundingRect?.height || pdfPageHeight
        
        // ✅ Calculate scaling factors
        const scaleX = pdfPageWidth / viewportWidth
        const scaleY = pdfPageHeight / viewportHeight
        
        console.log('📏 Scaling factors:', { scaleX, scaleY, viewportWidth, viewportHeight })

        // ✅ Draw each rect (untuk multi-line highlights)
        if (highlight.position.rects && highlight.position.rects.length > 0) {
          highlight.position.rects.forEach((rect, idx) => {
            // ✅ Scale coordinates dari viewport ke PDF
            const x1 = rect.x1 * scaleX
            const y1 = rect.y1 * scaleY
            const x2 = rect.x2 * scaleX
            const y2 = rect.y2 * scaleY
            
            // ✅ Convert Y coordinate (PDF uses bottom-left origin)
            const pdfX = x1
            const pdfY = pdfPageHeight - y2
            const pdfWidth = x2 - x1
            const pdfHeight = y2 - y1
            
            console.log(`  📌 Rect ${idx}:`, {
              viewport: { x1: rect.x1, y1: rect.y1, x2: rect.x2, y2: rect.y2 },
              pdf: { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight }
            })
            
            page.drawRectangle({
              x: pdfX,
              y: pdfY,
              width: pdfWidth,
              height: pdfHeight,
              color: rgb(1, 1, 0),
              opacity: 0.4,
              borderWidth: 0,
            })
          })
        } else if (highlight.position.boundingRect) {
          // ✅ Fallback to boundingRect
          const rect = highlight.position.boundingRect
          
          const x1 = rect.x1 * scaleX
          const y1 = rect.y1 * scaleY
          const x2 = rect.x2 * scaleX
          const y2 = rect.y2 * scaleY
          
          const pdfX = x1
          const pdfY = pdfPageHeight - y2
          const pdfWidth = x2 - x1
          const pdfHeight = y2 - y1
          
          page.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: pdfWidth,
            height: pdfHeight,
            color: rgb(1, 1, 0),
            opacity: 0.4,
            borderWidth: 0,
          })
        }

        // ✅ Add comment if exists
        if (highlight.comment?.text) {
          const rect = highlight.position.rects?.[0] || highlight.position.boundingRect
          if (rect) {
            const x1 = rect.x1 * scaleX
            const y2 = rect.y2 * scaleY
            
            const commentX = x1 + 2
            const commentY = pdfPageHeight - y2 - 12
            
            const fontSize = 8
            const maxWidth = Math.min(300, pdfPageWidth - commentX - 10)
            
            try {
              // Background for comment
              const textWidth = Math.min(highlight.comment.text.length * fontSize * 0.5, maxWidth)
              
              page.drawRectangle({
                x: commentX - 2,
                y: commentY - 2,
                width: textWidth + 4,
                height: fontSize + 4,
                color: rgb(1, 1, 0.9),
                opacity: 0.9,
              })
              
              // Comment text
              page.drawText(highlight.comment.text, {
                x: commentX,
                y: commentY,
                size: fontSize,
                color: rgb(0, 0, 0),
                maxWidth: maxWidth,
              })
            } catch (error) {
              console.error('Error drawing comment:', error)
            }
          }
        }
      }
    })

    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileUrl.split('/').pop()?.replace('.pdf', '')}_highlighted.pdf` || 'document_highlighted.pdf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    onAnalytics?.({
      action: "document_downloaded_with_highlights",
      document: fileUrl,
      highlightCount: highlights.length,
      timeStamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error downloading PDF with highlights:', error)
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = fileUrl.split('/').pop() || 'document.pdf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    setIsDownloading(false)
  }
}

  const HighlightPopup = ({ comment }: { comment: { text: string; emoji: string } }) =>
    comment?.text ? (
      <div
        className="Highlight__popup"
        style={{
          backgroundColor: isDark ? theme.colors.dark[6] : theme.colors.gray[0],
          color: isDark ? theme.colors.gray[0] : theme.colors.dark[7],
          border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
          borderRadius: theme.radius.sm,
          padding: "8px 12px",
          boxShadow: isDark ? `0 2px 8px ${theme.colors.dark[9]}` : `0 2px 8px ${theme.colors.gray[3]}`,
          fontSize: "14px",
          maxWidth: "200px",
        }}
      >
        {comment.text ? comment.text.replace(/[\u{1F300}-\u{1F9FF}]/gu, "").trim() : ""}
      </div>
    ) : null

  const CustomTip = ({
    onConfirm,
    onOpen,
  }: {
    onConfirm: (comment: { text: string; emoji: string }) => void
    onOpen: () => void
  }) => {
    const [text, setText] = useState("")

    useEffect(() => {
      onOpen()
    }, [onOpen])

    return (
      <div
        className="PdfHighlighter__tip-container"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          backgroundColor: isDark ? theme.colors.dark[6] : theme.colors.gray[0],
          border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
          borderRadius: theme.radius.sm,
          padding: "8px",
          boxShadow: isDark ? `0 2px 8px ${theme.colors.dark[9]}` : `0 2px 8px ${theme.colors.gray[3]}`,
        }}
      >
        <div className="PdfHighlighter__tip-compact">
          <input
            type="text"
            placeholder="Add note..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "150px",
              padding: "4px 8px",
              marginBottom: "8px",
              border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
              borderRadius: theme.radius.sm,
              backgroundColor: isDark ? theme.colors.dark[7] : theme.colors.gray[0],
              color: isDark ? theme.colors.gray[0] : theme.colors.dark[7],
            }}
          />
          <button
            type="submit"
            onClick={() => {
              onConfirm({ text: text.replace(/[\u{1F300}-\u{1F9FF}]/gu, "").trim(), emoji: "" })
              window.getSelection()?.removeAllRanges()
            }}
            style={{
              padding: "4px 12px",
              backgroundColor: theme.colors.blue[6],
              color: "white",
              border: "none",
              borderRadius: theme.radius.sm,
              cursor: "pointer",
            }}
          >
            Add
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: isDark ? theme.colors.dark[7] : theme.colors.gray[0],
        color: isDark ? theme.colors.gray[0] : theme.colors.dark[7],
      }}
    >
      <Group
        justify="end"
        p="sm"
        style={{
          backgroundColor: isDark ? theme.colors.dark[6] : theme.colors.gray[1],
          borderBottom: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
        }}
      >
        <Button 
          onClick={handleDownloadWithHighlights} 
          variant="light" 
          size="xs" 
          color="blue"
          leftSection={<IconDownload size={16} />}
          loading={isDownloading}
          disabled={isDownloading}
        >
          {isDownloading ? 'Downloading...' : 'Download PDF with Highlights'}
        </Button>
      </Group>
      <div style={{ display: "flex", height: "100%" }}>
        <div
          style={{
            flex: 3,
            position: "relative",
            backgroundColor: isDark ? theme.colors.dark[8] : theme.colors.gray[0],
          }}
        >
          <PdfLoader
            url={fileUrl}
            beforeLoad={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  backgroundColor: isDark ? theme.colors.dark[7] : theme.colors.gray[0],
                  color: isDark ? theme.colors.gray[0] : theme.colors.dark[7],
                }}
              >
                Loading PDF...
              </div>
            }
          >
            {(pdfDocument) => (
              <PdfHighlighter
                pdfDocument={pdfDocument}
                enableAreaSelection={(event) => event.altKey}
                scrollRef={(scrollTo) => {
                  scrollViewerTo.current = scrollTo
                  scrollToHighlightFromHash()
                }}
                onScrollChange={resetHash}
                onSelectionFinished={(position, content, hideTipAndSelection, transformSelection) => (
                  <CustomTip
                    onOpen={transformSelection}
                    onConfirm={(comment) => {
                      addHighlight({ content, position, comment })
                      hideTipAndSelection()
                    }}
                  />
                )}
                highlightTransform={(highlight, index, setTip, hideTip, viewportToScaled, screenshot, isScrolledTo) => {
                  const isTextHighlight = !highlight.content?.image
                  const component = isTextHighlight ? (
                    <Highlight
                      isScrolledTo={isScrolledTo}
                      position={highlight.position}
                      comment={highlight.comment}
                    />
                  ) : (
                    <AreaHighlight
                      isScrolledTo={isScrolledTo}
                      highlight={highlight}
                      onChange={(boundingRect) => {
                        updateHighlight(
                          highlight.id,
                          { boundingRect: viewportToScaled(boundingRect) },
                          { image: screenshot(boundingRect) },
                        )
                      }}
                    />
                  )
                  return (
                    <Popup
                      popupContent={<HighlightPopup comment={highlight.comment} />}
                      onMouseOver={() => setTip(highlight, () => <HighlightPopup comment={highlight.comment} />)}
                      onMouseOut={hideTip}
                      key={index}
                    >
                      {component}
                    </Popup>
                  )
                }}
                highlights={highlights}
              />
            )}
          </PdfLoader>
        </div>
        <div
          style={{
            flex: 1,
            borderLeft: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
            backgroundColor: isDark ? theme.colors.dark[6] : theme.colors.gray[0],
            padding: "1rem",
            overflowY: "auto",
          }}
        >
          <Title order={5} mb="sm" c={isDark ? "gray.0" : "dark.7"}>
            Highlighted Notes
          </Title>
          <Divider mb="sm" color={isDark ? theme.colors.dark[4] : theme.colors.gray[3]} />
          <ScrollArea h="100%">
            {isLoadingAnnotations ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <Loader size="sm" />
              </div>
            ) : (
              <Stack>
                {highlights.length === 0 ? (
                  <Text c="dimmed" size="sm">
                    Belum ada highlight.
                  </Text>
                ) : (
                  highlights.map((h) => {
                    const text = typeof h.content === "string" ? h.content : h.content?.text || ""
                    return (
                      <Card
                        key={h.id}
                        withBorder
                        radius="md"
                        shadow="sm"
                        style={{
                          cursor: "pointer",
                          transition: "0.2s",
                          backgroundColor: isDark ? theme.colors.dark[5] : theme.colors.gray[0],
                          borderColor: isDark ? theme.colors.dark[4] : theme.colors.gray[3],
                          position: 'relative',
                        }}
                        mih={80}
                      >
                        <div onClick={() => scrollViewerTo.current(h)}>
                          <Text size="xs" c="dimmed" mb={4}>
                            Page {h.position.pageNumber}
                          </Text>
                          {text && (
                            <Text size="sm" fw={500} lineClamp={3} mb={4} c={isDark ? "gray.0" : "dark.7"}>
                              {text}
                            </Text>
                          )}
                          {h.comment?.text && (
                            <Text size="sm" c={isDark ? "gray.3" : "gray.7"}>
                              Note: {h.comment.text.replace(/[\u{1F300}-\u{1F9FF}]/gu, "").trim()}
                            </Text>
                          )}
                        </div>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          size="sm"
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteHighlight(h.id)
                          }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Card>
                    )
                  })
                )}
              </Stack>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

export default WebViewer