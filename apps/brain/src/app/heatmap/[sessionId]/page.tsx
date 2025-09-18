'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Container,
  Grid,
  Paper,
  Title,
  Text,
  Button,
  Slider,
  Group,
  Stack,
  Card,
  Loader,
  Center,
  Alert,
  Divider,
  Badge,
  ActionIcon,
  Tooltip,
  Switch,
  ColorSwatch,
  Flex,
  Box,
  Progress,
  rem
} from '@mantine/core'
import {
  IconArrowBack,
  IconDownload,
  IconSettings,
  IconEye,
  IconClock,
  IconTarget,
  IconAlertCircle,
  IconRefresh,
  IconPhoto,
  IconAnalyze,
  IconCheck,
  IconX,
  IconDatabase,
  IconChartDots
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'

// ✅ IMPROVED TYPE DECLARATIONS
declare global {
  interface Window {
    h337?: {
      create: (config: {
        container: HTMLElement
        radius?: number
        maxOpacity?: number
        minOpacity?: number
        blur?: number
        gradient?: Record<string, string>
      }) => {
        setData: (data: { 
          max: number
          data: Array<{ x: number; y: number; value: number }> 
        }) => void
        getDataURL: () => string
        configure: (config: any) => void
      }
    }
  }
}

export default function HeatmapPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string
  const heatmapRef = useRef<HTMLDivElement>(null)
  const heatmapInstance = useRef<any>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [heatmapReady, setHeatmapReady] = useState(false)
  const [heatmapLibLoaded, setHeatmapLibLoaded] = useState(false)
  const [heatmapLibError, setHeatmapLibError] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>({})
  
  const [heatmapConfig, setHeatmapConfig] = useState({
    radius: 40,
    maxOpacity: 0.8,
    minOpacity: 0.1,
    blur: 0.75,
    showScreenshot: true
  })

  // ✅ IMPROVED DEBUG LOGGING
  const logDebug = (message: string, data?: any) => {
    console.log(`[HEATMAP DEBUG] ${message}`, data || '')
    setDebugInfo(prev => ({
      ...prev,
      [Date.now()]: { message, data, timestamp: new Date().toISOString() }
    }))
  }

  // ✅ COMPLETELY REWRITTEN HEATMAP.JS LOADING WITH MULTIPLE CDN FALLBACKS
  useEffect(() => {
    if (typeof window === 'undefined') {
      logDebug('Window is undefined (SSR)')
      return
    }

    logDebug('Starting heatmap library loading process')

    // Check if library is already available
    if (window.h337) {
      logDebug('heatmap.js already loaded and available')
      setHeatmapLibLoaded(true)
      setHeatmapLibError(false)
      return
    }

    // Clean up any existing scripts first
    const existingScripts = document.querySelectorAll('script[src*="heatmap"]')
    existingScripts.forEach(script => {
      logDebug('Removing existing heatmap script')
      script.remove()
    })

    // CDN options in order of preference
    const cdnUrls = [
      'https://cdnjs.cloudflare.com/ajax/libs/heatmap.js/2.0.5/heatmap.min.js',
      'https://unpkg.com/heatmap.js@2.0.5/build/heatmap.min.js',
      'https://cdn.jsdelivr.net/npm/heatmap.js@2.0.5/build/heatmap.min.js'
    ]

    let currentCdnIndex = 0
    
    const loadScript = (url: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        logDebug(`Attempting to load heatmap.js from: ${url}`)
        
        const script = document.createElement('script')
        script.src = url
        script.async = true
        script.crossOrigin = 'anonymous'
        
        const timeout = setTimeout(() => {
          logDebug(`Timeout loading from ${url}`)
          script.remove()
          reject(new Error(`Timeout loading ${url}`))
        }, 10000) // 10 second timeout
        
        script.onload = () => {
          clearTimeout(timeout)
          logDebug(`Script loaded from ${url}`)
          
          // Wait a bit for library to initialize and check
          setTimeout(() => {
            if (window.h337) {
              logDebug(`Library successfully available from ${url}`)
              resolve()
            } else {
              logDebug(`Script loaded but library not available from ${url}`)
              script.remove()
              reject(new Error(`Library not available after loading ${url}`))
            }
          }, 200)
        }

        script.onerror = () => {
          clearTimeout(timeout)
          logDebug(`Script load error from ${url}`)
          script.remove()
          reject(new Error(`Failed to load ${url}`))
        }

        document.head.appendChild(script)
      })
    }

    const tryLoadScript = async () => {
      while (currentCdnIndex < cdnUrls.length) {
        try {
          await loadScript(cdnUrls[currentCdnIndex])
          setHeatmapLibLoaded(true)
          setHeatmapLibError(false)
          logDebug(`Successfully loaded heatmap.js from CDN ${currentCdnIndex + 1}`)
          return
        } catch (error) {
          logDebug(`Failed to load from CDN ${currentCdnIndex + 1}: ${error}`)
          currentCdnIndex++
        }
      }
      
      // All CDNs failed
      logDebug('All CDN attempts failed')
      setHeatmapLibError(true)
      setHeatmapLibLoaded(false)
      
      notifications.show({
        title: 'Library Load Failed',
        message: 'Unable to load heatmap visualization library from any CDN. Please check your internet connection.',
        color: 'red',
        icon: <IconX size={rem(16)} />,
        autoClose: 8000,
      })
    }

    tryLoadScript()

    return () => {
      // Cleanup any scripts we added
      const scripts = document.querySelectorAll('script[src*="heatmap"]')
      scripts.forEach(script => {
        if (cdnUrls.some(url => script.getAttribute('src')?.includes('heatmap'))) {
          script.remove()
          logDebug('Cleanup: Script tag removed from head')
        }
      })
    }
  }, [])

  // ✅ IMPROVED DATA FETCHING WITH BETTER ERROR HANDLING
  useEffect(() => {
    if (!sessionId) {
      logDebug('No sessionId provided')
      setError('No session ID provided')
      setLoading(false)
      return
    }

    logDebug('Starting data fetch', { sessionId })

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        logDebug('Fetching gaze data from API', { url: `/api/gaze-events/${sessionId}` })
        
        const response = await fetch(`/api/gaze-events/${sessionId}`)
        
        logDebug('API response received', { 
          status: response.status, 
          ok: response.ok,
          statusText: response.statusText 
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          logDebug('API response not ok', { status: response.status, errorText })
          throw new Error(`API Error ${response.status}: ${errorText}`)
        }
        
        const result = await response.json()
        logDebug('API data parsed', { 
          success: result.success,
          hasHeatmapData: !!result.heatmapData,
          dataLength: result.heatmapData?.length || 0,
          hasScreenshot: !!result.screenshot
        })
        
        if (!result.success) {
          throw new Error(result.message || 'API returned success: false')
        }

        if (!result.heatmapData || result.heatmapData.length === 0) {
          throw new Error('No heatmap data available for this session')
        }
        
        setData(result)
        logDebug('Data successfully set', { totalPoints: result.heatmapData.length })

        notifications.show({
          title: 'Data Loaded Successfully',
          message: `Loaded ${result.heatmapData.length} gaze points`,
          color: 'green',
          icon: <IconCheck size={rem(16)} />,
          autoClose: 3000,
        })
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
        logDebug('Data fetch error', { error: errorMessage })
        setError(errorMessage)
        
        notifications.show({
          title: 'Failed to Load Data',
          message: errorMessage,
          color: 'red',
          icon: <IconX size={rem(16)} />,
          autoClose: 5000,
        })
      } finally {
        setLoading(false)
        logDebug('Data fetch completed')
      }
    }

    fetchData()
  }, [sessionId])

  // ✅ IMPROVED HEATMAP CREATION WITH COORDINATE SCALING
  useEffect(() => {
    const dependencies = {
      hasData: !!data,
      hasHeatmapData: !!data?.heatmapData,
      dataLength: data?.heatmapData?.length || 0,
      libLoaded: heatmapLibLoaded,
      hasWindow: !!window.h337,
      hasRef: !!heatmapRef.current,
      imageNeeded: data?.screenshot && heatmapConfig.showScreenshot,
      imageLoaded: imageLoaded,
      imageError: imageError
    }

    logDebug('Checking heatmap dependencies', dependencies)

    // Basic requirements
    if (!data || !data.heatmapData || !heatmapLibLoaded || !window.h337 || !heatmapRef.current) {
      logDebug('Missing basic dependencies', dependencies)
      return
    }

    // Image requirements (if screenshot is enabled)
    if (data.screenshot && heatmapConfig.showScreenshot && !imageLoaded && !imageError) {
      logDebug('Waiting for image to load', { hasScreenshot: !!data.screenshot, showScreenshot: heatmapConfig.showScreenshot })
      return
    }

    logDebug('All dependencies satisfied, creating heatmap')

    // Clean up previous instance
    if (heatmapInstance.current) {
      try {
        heatmapInstance.current.setData({ data: [], max: 1 })
        logDebug('Previous heatmap instance cleaned up')
      } catch (e) {
        logDebug('Error cleaning up previous instance', e)
      }
    }

    // Create heatmap
    try {
      logDebug('Creating new heatmap instance with config', heatmapConfig)
      
      heatmapInstance.current = window.h337!.create({
        container: heatmapRef.current,
        radius: heatmapConfig.radius,
        maxOpacity: heatmapConfig.maxOpacity,
        minOpacity: heatmapConfig.minOpacity,
        blur: heatmapConfig.blur,
        gradient: {
          0.25: "rgb(0,0,255)",
          0.55: "rgb(0,255,0)",
          0.85: "yellow",
          1.0: "rgb(255,0,0)"
        }
      })

      // ✅ COORDINATE SCALING LOGIC - NEW ADDITION
      let scaledHeatmapData = [...data.heatmapData]
      
      // If we have screenshot and it's being displayed, scale coordinates
      if (data.screenshot && heatmapConfig.showScreenshot && imageRef.current) {
        const displayedImage = imageRef.current
        const displayedWidth = displayedImage.clientWidth
        const displayedHeight = displayedImage.clientHeight
        
        // Get original screenshot dimensions from metadata or estimate
        const originalWidth = data.metadata?.originalWidth || data.metadata?.screenWidth || 1920
        const originalHeight = data.metadata?.originalHeight || data.metadata?.screenHeight || 1080
        
        const scaleX = displayedWidth / originalWidth
        const scaleY = displayedHeight / originalHeight
        
        logDebug('Scaling coordinates', {
          originalWidth,
          originalHeight,
          displayedWidth,
          displayedHeight,
          scaleX: scaleX.toFixed(3),
          scaleY: scaleY.toFixed(3)
        })
        
        // Scale each data point
        scaledHeatmapData = data.heatmapData.map((point: any) => ({
          ...point,
          x: Math.round(point.x * scaleX),
          y: Math.round(point.y * scaleY)
        }))
        
        logDebug('Sample coordinate transformation', {
          original: data.heatmapData[0],
          scaled: scaledHeatmapData[0]
        })
      } else {
        logDebug('No coordinate scaling applied - using original data')
      }

      // Prepare data with scaled coordinates
      const maxValue = Math.max(...scaledHeatmapData.map((point: any) => point.value))
      const heatmapData = {
        max: maxValue,
        data: scaledHeatmapData
      }

      logDebug('Setting heatmap data', { 
        maxValue, 
        pointCount: scaledHeatmapData.length,
        samplePoint: scaledHeatmapData[0],
        isScaled: data.screenshot && heatmapConfig.showScreenshot && imageRef.current
      })

      heatmapInstance.current.setData(heatmapData)
      setHeatmapReady(true)
      
      logDebug('Heatmap successfully created and rendered')

      notifications.show({
        title: 'Heatmap Generated',
        message: `Visualization ready with ${scaledHeatmapData.length} points`,
        color: 'blue',
        icon: <IconAnalyze size={rem(16)} />,
        autoClose: 2000,
      })

    } catch (err) {
      logDebug('Heatmap creation error', err)
      setError('Failed to create heatmap visualization')
      
      notifications.show({
        title: 'Visualization Failed',
        message: 'Unable to generate heatmap',
        color: 'red',
        icon: <IconX size={rem(16)} />,
        autoClose: 5000,
      })
    }
  }, [data, heatmapConfig, imageLoaded, imageError, heatmapLibLoaded])

  // Update heatmap configuration
  const updateHeatmapConfig = (key: string, value: any) => {
    logDebug(`Updating heatmap config: ${key} = ${value}`)
    setHeatmapConfig(prev => ({ ...prev, [key]: value }))
    setHeatmapReady(false)
  }

  // Export heatmap
  const exportHeatmap = () => {
    if (!heatmapInstance.current) {
      notifications.show({
        title: 'Export Failed',
        message: 'Heatmap is not ready for export',
        color: 'orange',
        icon: <IconX size={rem(16)} />,
      })
      return
    }
    
    try {
      const canvas = heatmapInstance.current.getDataURL()
      const link = document.createElement('a')
      link.download = `gaze-heatmap-${sessionId}-${Date.now()}.png`
      link.href = canvas
      link.click()
      
      logDebug('Heatmap exported successfully')
      
      notifications.show({
        title: 'Export Successful',
        message: 'Heatmap image has been downloaded',
        color: 'green',
        icon: <IconDownload size={rem(16)} />,
        autoClose: 3000,
      })
    } catch (err) {
      logDebug('Export error', err)
      notifications.show({
        title: 'Export Failed',
        message: 'Unable to export heatmap image',
        color: 'red',
        icon: <IconX size={rem(16)} />,
      })
    }
  }

  // Refresh data
  const refreshData = () => {
    logDebug('Refreshing page data')
    window.location.reload()
  }

  // Image event handlers
  const handleImageLoad = () => {
    logDebug('Screenshot image loaded successfully')
    setImageLoaded(true)
    setImageError(false)
  }

  const handleImageError = () => {
    logDebug('Screenshot image load failed')
    setImageError(true)
    setImageLoaded(false)
    
    notifications.show({
      title: 'Screenshot Load Failed',
      message: 'Unable to load background image',
      color: 'orange',
      icon: <IconPhoto size={rem(16)} />,
      autoClose: 4000,
    })
  }

  // ✅ IMPROVED LOADING STATE WITH BETTER STATUS
  if (loading || (!heatmapLibLoaded && !heatmapLibError)) {
    const getLoadingMessage = () => {
      if (loading) return 'Loading gaze tracking data...'
      if (!heatmapLibLoaded && !heatmapLibError) return 'Loading visualization library...'
      return 'Initializing...'
    }

    const getProgressValue = () => {
      if (loading) return 30
      if (!heatmapLibLoaded && !heatmapLibError) return 60
      return 80
    }

    return (
      <Container fluid style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Center>
          <Stack align="center" gap="md">
            <Loader size="lg" variant="bars" />
            <Text size="lg" c="dimmed">
              {getLoadingMessage()}
            </Text>
            <Text size="sm" c="dimmed">Session: {sessionId}</Text>
            <Progress value={getProgressValue()} animated style={{ width: 300 }} />
            
            {/* Library Loading Status */}
            {!loading && (
              <Group gap="xs">
                <Badge 
                  variant="light" 
                  color={heatmapLibLoaded ? 'green' : heatmapLibError ? 'red' : 'blue'}
                >
                  Library: {heatmapLibLoaded ? 'Ready' : heatmapLibError ? 'Failed' : 'Loading'}
                </Badge>
              </Group>
            )}
            
            {/* Debug Information */}
            {Object.keys(debugInfo).length > 0 && (
              <Card withBorder p="xs" style={{ maxWidth: 400 }}>
                <Text size="xs" fw={500} mb="xs">Debug Info:</Text>
                <Stack gap={4}>
                  {Object.entries(debugInfo).slice(-3).map(([key, info]: [string, any]) => (
                    <Text key={key} size="xs" c="dimmed">
                      {info.timestamp.split('T')[1].split('.')[0]}: {info.message}
                    </Text>
                  ))}
                </Stack>
              </Card>
            )}
          </Stack>
        </Center>
      </Container>
    )
  }

  // Error states
  if (heatmapLibError) {
    return (
      <Container fluid style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Center>
          <Card shadow="sm" padding="xl" radius="md" withBorder style={{ maxWidth: 500 }}>
            <Stack align="center" gap="md">
              <IconAlertCircle size={60} color="var(--mantine-color-red-6)" />
              <Title order={2} c="red">Library Load Failed</Title>
              <Text c="dimmed" ta="center" size="sm">
                Unable to load heatmap visualization library from any CDN source. Please check your internet connection and firewall settings.
              </Text>
              <Text size="xs" c="dimmed" ta="center">
                Tried: CDNJS, unpkg, and jsDelivr
              </Text>
              <Text size="xs" c="dimmed">Session ID: {sessionId}</Text>
              <Group>
                <Button variant="outline" leftSection={<IconArrowBack size={16} />} onClick={() => router.back()}>
                  Go Back
                </Button>
                <Button leftSection={<IconRefresh size={16} />} onClick={refreshData}>
                  Retry
                </Button>
              </Group>
            </Stack>
          </Card>
        </Center>
      </Container>
    )
  }

  if (error) {
    return (
      <Container fluid style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Center>
          <Card shadow="sm" padding="xl" radius="md" withBorder style={{ maxWidth: 500 }}>
            <Stack align="center" gap="md">
              <IconAlertCircle size={60} color="var(--mantine-color-red-6)" />
              <Title order={2} c="red">Unable to Load Data</Title>
              <Text c="dimmed" ta="center" size="sm">{error}</Text>
              <Text size="xs" c="dimmed">Session ID: {sessionId}</Text>
              
              {/* Debug info in error state */}
              {Object.keys(debugInfo).length > 0 && (
                <Card withBorder p="sm" style={{ width: '100%' }}>
                  <Text size="xs" fw={500} mb="xs">Debug Trail:</Text>
                  <Stack gap={2}>
                    {Object.entries(debugInfo).slice(-5).map(([key, info]: [string, any]) => (
                      <Text key={key} size="xs" c="dimmed" ff="monospace">
                        {info.timestamp.split('T')[1].split('.')[0]}: {info.message}
                      </Text>
                    ))}
                  </Stack>
                </Card>
              )}
              
              <Group>
                <Button variant="outline" leftSection={<IconArrowBack size={16} />} onClick={() => router.back()}>
                  Go Back
                </Button>
                <Button leftSection={<IconRefresh size={16} />} onClick={refreshData}>
                  Retry
                </Button>
              </Group>
            </Stack>
          </Card>
        </Center>
      </Container>
    )
  }

  // Main heatmap interface
  return (
    <Container fluid>
      {/* Header */}
      <Paper shadow="xs" p="md" mb="md" withBorder>
        <Flex justify="space-between" align="center">
          <div>
            <Group gap="xs" mb="xs">
              <IconChartDots size={24} />
              <Title order={2}>Gaze Tracking Heatmap</Title>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">Session:</Text>
              <Badge variant="light" size="lg">{sessionId}</Badge>
              {data?.screenshot && (
                <Badge variant="light" color="green" leftSection={<IconPhoto size={12} />}>
                  Screenshot Available
                </Badge>
              )}
              <Badge variant="light" color="blue" leftSection={<IconDatabase size={12} />}>
                {data?.heatmapData?.length || 0} Points
              </Badge>
              {heatmapReady && (
                <Badge variant="light" color="green" leftSection={<IconCheck size={12} />}>
                  Visualization Ready
                </Badge>
              )}
            </Group>
          </div>
          <Button 
            variant="outline" 
            leftSection={<IconArrowBack size={16} />}
            onClick={() => router.back()}
          >
            Back
          </Button>
        </Flex>
      </Paper>

      <Grid>
        {/* Control Panel */}
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Stack gap="md">
            {/* Heatmap Controls */}
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="md">
                <Text fw={500}>
                  <IconSettings size={16} style={{ display: 'inline', marginRight: 8 }} />
                  Heatmap Controls
                </Text>
                {heatmapReady ? (
                  <Badge size="xs" color="green">Ready</Badge>
                ) : (
                  <Badge size="xs" color="orange">Preparing...</Badge>
                )}
              </Group>
              
              <Stack gap="md">
                <div>
                  <Text size="sm" fw={500} mb="xs">
                    Radius: {heatmapConfig.radius}px
                  </Text>
                  <Slider
                    value={heatmapConfig.radius}
                    onChange={(value) => updateHeatmapConfig('radius', value)}
                    min={20}
                    max={100}
                    step={5}
                    marks={[
                      { value: 20, label: '20' },
                      { value: 60, label: '60' },
                      { value: 100, label: '100' }
                    ]}
                  />
                </div>

                <div>
                  <Text size="sm" fw={500} mb="xs">
                    Max Opacity: {heatmapConfig.maxOpacity}
                  </Text>
                  <Slider
                    value={heatmapConfig.maxOpacity}
                    onChange={(value) => updateHeatmapConfig('maxOpacity', value)}
                    min={0.1}
                    max={1}
                    step={0.1}
                    precision={1}
                    marks={[
                      { value: 0.2, label: '0.2' },
                      { value: 0.6, label: '0.6' },
                      { value: 1.0, label: '1.0' }
                    ]}
                  />
                </div>

                <div>
                  <Text size="sm" fw={500} mb="xs">
                    Blur Level: {heatmapConfig.blur}
                  </Text>
                  <Slider
                    value={heatmapConfig.blur}
                    onChange={(value) => updateHeatmapConfig('blur', value)}
                    min={0.1}
                    max={1}
                    step={0.05}
                    precision={2}
                    marks={[
                      { value: 0.1, label: '0.1' },
                      { value: 0.5, label: '0.5' },
                      { value: 1.0, label: '1.0' }
                    ]}
                  />
                </div>

                <Switch
                  label="Show Background Screenshot"
                  description="Toggle screenshot overlay"
                  checked={heatmapConfig.showScreenshot}
                  onChange={(event) => updateHeatmapConfig('showScreenshot', event.currentTarget.checked)}
                  disabled={!data?.screenshot}
                />

                <Divider />

                <Button
                  fullWidth
                  leftSection={<IconDownload size={16} />}
                  onClick={exportHeatmap}
                  variant="filled"
                  disabled={!heatmapReady}
                >
                  Export as PNG
                </Button>
              </Stack>
            </Card>

            {/* Statistics */}
            {data?.stats && (
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                  <Text fw={500}>Session Statistics</Text>
                  <IconEye size={16} />
                </Group>
                
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Valid Gaze Points:</Text>
                    <Badge variant="light">{data.heatmapData?.length || 0}</Badge>
                  </Group>
                  
                  {data.stats.avgIntensity && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Average Intensity:</Text>
                      <Badge variant="light">{data.stats.avgIntensity.toFixed(2)}</Badge>
                    </Group>
                  )}

                  {data.metadata?.dataQuality && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Data Quality:</Text>
                      <Badge 
                        variant="light"
                        color={data.metadata.dataQuality > 0.8 ? 'green' : data.metadata.dataQuality > 0.5 ? 'yellow' : 'red'}
                      >
                        {(data.metadata.dataQuality * 100).toFixed(1)}%
                      </Badge>
                    </Group>
                  )}
                </Stack>
              </Card>
            )}

            {/* Color Legend */}
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Text fw={500} mb="md">Intensity Scale</Text>
              <Stack gap="xs">
                <Group gap="xs">
                  <ColorSwatch color="rgb(0,0,255)" size={16} />
                  <Text size="sm">Low Focus</Text>
                </Group>
                <Group gap="xs">
                  <ColorSwatch color="rgb(0,255,0)" size={16} />
                  <Text size="sm">Moderate Focus</Text>
                </Group>
                <Group gap="xs">
                  <ColorSwatch color="yellow" size={16} />
                  <Text size="sm">High Focus</Text>
                </Group>
                <Group gap="xs">
                  <ColorSwatch color="rgb(255,0,0)" size={16} />
                  <Text size="sm">Intense Focus</Text>
                </Group>
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>

        {/* Heatmap Visualization */}
        <Grid.Col span={{ base: 12, md: 9 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={500} size="lg">Gaze Heatmap Visualization</Text>
              <Group gap="xs">
                <Tooltip label="Refresh Analysis">
                  <ActionIcon variant="subtle" onClick={refreshData}>
                    <IconRefresh size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
            
            <Box style={{ position: 'relative', minHeight: 400 }}>
              {/* Background Screenshot */}
              {data?.screenshot && heatmapConfig.showScreenshot && (
                <div style={{ position: 'relative' }}>
                  <Image
                    ref={imageRef}
                    src={data.screenshot}
                    alt="Page Screenshot"
                    width={1200}
                    height={800}
                    style={{ 
                      width: '100%', 
                      height: 'auto', 
                      borderRadius: rem(8),
                      opacity: imageError ? 0.3 : 1
                    }}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    priority
                  />
                  {!imageLoaded && !imageError && (
                    <Box style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      padding: rem(16),
                      borderRadius: rem(8)
                    }}>
                      <Stack align="center" gap="xs">
                        <Loader size="md" />
                        <Text size="xs" c="dimmed">Loading screenshot...</Text>
                      </Stack>
                    </Box>
                  )}
                </div>
              )}
              
              {/* Heatmap Overlay */}
              <div 
                ref={heatmapRef}
                style={{
                  position: data?.screenshot && heatmapConfig.showScreenshot ? 'absolute' : 'relative',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: data?.screenshot && heatmapConfig.showScreenshot ? '100%' : '600px',
                  pointerEvents: 'none',
                  backgroundColor: data?.screenshot && heatmapConfig.showScreenshot ? 'transparent' : '#f8f9fa',
                  borderRadius: rem(8),
                  minHeight: 400
                }}
              />

              {/* Loading Overlay for Heatmap */}
              {!heatmapReady && heatmapLibLoaded && data && (
                <Box style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  padding: rem(20),
                  borderRadius: rem(8),
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  zIndex: 10
                }}>
                  <Stack align="center" gap="xs">
                    <Loader size="md" variant="dots" />
                    <Text size="sm" c="dimmed">Generating heatmap...</Text>
                  </Stack>
                </Box>
              )}
            </Box>

            {/* Status Messages and Alerts */}
            <Stack gap="xs" mt="md">
              {imageError && data?.screenshot && (
                <Alert variant="light" color="orange" title="Background Image Error">
                  <Text size="sm">
                    Unable to load reference image. Heatmap is displayed without background context.
                  </Text>
                </Alert>
              )}

              {!data?.screenshot && (
                <Alert variant="light" color="blue" title="No Reference Image">
                  <Text size="sm">
                    No reference image available for this session. Add a screenshot for better context.
                  </Text>
                </Alert>
              )}

              {data?.metadata?.dataQuality && data.metadata.dataQuality < 0.5 && (
                <Alert variant="light" color="yellow" title="Low Data Quality Warning">
                  <Text size="sm">
                    Only {(data.metadata.dataQuality * 100).toFixed(1)}% of gaze events have valid coordinates. 
                    Results may not be fully representative of user behavior.
                  </Text>
                </Alert>
              )}

              {heatmapReady && data?.heatmapData && (
                <Alert variant="light" color="green" title="Heatmap Ready">
                  <Text size="sm">
                    Successfully visualized {data.heatmapData.length} gaze points. 
                    Use the controls to adjust visualization parameters.
                  </Text>
                </Alert>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Debug Panel (only in development) */}
      {process.env.NODE_ENV === 'development' && Object.keys(debugInfo).length > 0 && (
        <Card shadow="sm" padding="md" radius="md" withBorder mt="md">
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>Debug Information</Text>
            <Badge size="xs" variant="outline">Development Only</Badge>
          </Group>
          <Box style={{ 
            maxHeight: 200, 
            overflowY: 'auto',
            fontSize: '11px',
            fontFamily: 'monospace',
            backgroundColor: '#f8f9fa',
            padding: rem(8),
            borderRadius: rem(4)
          }}>
            {Object.entries(debugInfo).slice(-10).map(([key, info]: [string, any]) => (
              <div key={key} style={{ marginBottom: 2 }}>
                <span style={{ color: '#666' }}>
                  {info.timestamp.split('T')[1].split('.')[0]}
                </span>
                {' - '}
                <span>{info.message}</span>
                {info.data && (
                  <span style={{ color: '#888' }}>
                    {' '}({typeof info.data === 'object' ? JSON.stringify(info.data) : info.data})
                  </span>
                )}
              </div>
            ))}
          </Box>
        </Card>
      )}
    </Container>
  )
}