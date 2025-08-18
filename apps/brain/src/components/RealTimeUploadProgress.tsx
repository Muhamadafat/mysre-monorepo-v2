import React, { useState, useEffect } from 'react';
import { Loader, Text, Stack, Progress } from '@mantine/core';
import { IconUpload, IconFileText, IconNetwork, IconDatabase, IconBolt, IconCheck, IconAlertCircle } from '@tabler/icons-react';

interface RealUploadProgressProps {
  uploadId: string | null;
  uploading: boolean;
  onComplete?: () => void;
  hasSessionId?: boolean; // tambahan untuk menentukan apakah akan ada edge generation
}

// Definisi tahapan yang sama dengan SimpleUploadProgress
const UPLOAD_STAGES = [
  {
    key: 'uploading_file',
    title: 'Upload File',
    description: 'Mengirim file ke cloud storage...',
    icon: IconUpload,
    color: 'blue'
  },
  {
    key: 'saving_database',
    title: 'Simpan Database',
    description: 'Membuat record artikel baru...',
    icon: IconDatabase,
    color: 'blue'
  },
  {
    key: 'ai_processing',
    title: 'Analisis AI',
    description: 'AI sedang membaca dan menganalisis dokumen...',
    icon: IconFileText,
    color: 'purple'
  },
  {
    key: 'generating_nodes',
    title: 'Membuat Node',
    description: 'Menghasilkan representasi dokumen...',
    icon: IconBolt,
    color: 'green'
  },
  {
    key: 'generating_edges',
    title: 'Mencari Koneksi',
    description: 'Menganalisis hubungan dengan dokumen lain...',
    icon: IconNetwork,
    color: 'orange'
  },
  {
    key: 'completed',
    title: 'Selesai',
    description: 'Proses upload berhasil!',
    icon: IconCheck,
    color: 'green'
  }
];

export const RealUploadProgress: React.FC<RealUploadProgressProps> = ({ 
  uploadId,
  uploading, 
  onComplete,
  hasSessionId = true
}) => {
  const [currentStage, setCurrentStage] = useState('');
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  // Filter stages berdasarkan apakah ada sessionId (sama seperti SimpleUploadProgress)
  const activeStages = hasSessionId 
    ? UPLOAD_STAGES 
    : UPLOAD_STAGES.filter(stage => stage.key !== 'generating_edges');

  const getCurrentStageInfo = () => {
    // Jika sudah selesai, langsung tampilkan stage 'completed'
    if (isComplete || progress === 100) {
      return activeStages.find(stage => stage.key === 'completed')!;
    }

    // Langsung cari stage berdasarkan 'key' yang dikirim dari backend
    const stageFromKey = activeStages.find(stage => stage.key === currentStage);

    // Jika key ditemukan, gunakan itu. Jika tidak, gunakan stage pertama.
    return stageFromKey || activeStages[0];
  };

  // Fungsi untuk mendapatkan index stage saat ini
  const getCurrentStageIndex = () => {
    const currentStageInfo = getCurrentStageInfo();
    return activeStages.findIndex(stage => stage.key === currentStageInfo.key);
  };

  useEffect(() => {
    if (!uploading || !uploadId) {
      setCurrentStage('');
      setProgress(0);
      setIsComplete(false);
      return;
    }

    // ✅ Koneksi ke real progress API (logika asli tetap sama)
    const eventSource = new EventSource(`/api/upload-progress?uploadId=${uploadId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        console.log('📨 Received progress data:', data); // ✅ Add debug log
        
        switch (data.type) {
          case 'connected':
            console.log('✅ Progress tracking connected');
            break;
            
          case 'progress':
            setCurrentStage(data.stage || data.message || '');
            setProgress(data.progress || data.percentage || 0); // ✅ Check both fields
            break;
            
          case 'complete':
            setIsComplete(true);
            setProgress(100);
            setCurrentStage('completed');
            
            // ✅ Real completion dari backend
            setTimeout(() => {
              onComplete?.();
            }, 1000);
            break;
            
          case 'error':
            console.error('❌ Upload error:', data.message);
            break;
        }
      } catch (error) {
        console.error('❌ Error parsing progress data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ EventSource error:', error);
    };

    return () => {
      eventSource.close();
    };
  }, [uploadId, uploading, onComplete]);

  if (!uploading) return null;

  const currentStageInfo = getCurrentStageInfo();
  const currentStageIndex = getCurrentStageIndex();
  const IconComponent = currentStageInfo.icon;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '2.5rem',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          textAlign: 'center',
          minWidth: '400px',
          maxWidth: '500px',
        }}
      >
        <Stack align="center" gap="lg">
          {/* Icon dan Status */}
          <div style={{ position: 'relative' }}>
            {isComplete || currentStageInfo.key === 'completed' ? (
              <div 
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: '#51cf66',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <IconCheck size={32} color="white" />
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <Loader size="xl" color={currentStageInfo.color} />
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: '50%', 
                    left: '50%', 
                    transform: 'translate(-50%, -50%)' 
                  }}
                >
                  <IconComponent size={24} />
                </div>
              </div>
            )}
          </div>

          {/* Title dan Description */}
          <div>
            <Text size="xl" fw={600} mb="xs">
              {currentStageInfo.title}
            </Text>
            <Text size="md" c="dimmed">
              {isComplete ? 'Upload berhasil!' : currentStageInfo.description}
            </Text>
          </div>

          {/* Progress Bar Overall */}
          <div style={{ width: '100%' }}>
            <Text size="sm" c="dimmed" mb="xs">
              Progress Keseluruhan ({Math.round(progress)}%)
            </Text>
            <Progress 
              value={progress} 
              size="md" 
              radius="xl" 
              color={isComplete ? 'green' : currentStageInfo.color}
              animated={!isComplete && currentStageInfo.key !== 'completed'}
            />
          </div>

          {/* Progress Bar Stage - dengan infinite loading animation */}
          {!isComplete && currentStageInfo.key !== 'completed' && (
            <div style={{ width: '100%' }}>
              <Text size="xs" c="dimmed" mb="xs">
                {currentStageInfo.title}
              </Text>
              <div 
                style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#e9ecef',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  position: 'relative'
                }}
              >
                <div
                  style={{
                    width: '30%',
                    height: '100%',
                    background: `linear-gradient(90deg, transparent, ${currentStageInfo.color === 'blue' ? '#1971c2' : currentStageInfo.color === 'purple' ? '#7048e8' : currentStageInfo.color === 'green' ? '#51cf66' : '#fd7e14'})`,
                    borderRadius: '4px',
                    animation: 'infiniteProgress 1.5s linear infinite',
                  }}
                />
              </div>
              <style jsx>{`
                @keyframes infiniteProgress {
                  0% {
                    transform: translateX(-100%);
                  }
                  100% {
                    transform: translateX(400%);
                  }
                }
              `}</style>
            </div>
          )}

          {/* Daftar Tahapan */}
          <div style={{ width: '100%', textAlign: 'left' }}>
            <Text size="sm" fw={500} mb="sm" style={{ textAlign: 'center' }}>
              Tahapan Proses:
            </Text>
            <Stack gap="xs">
              {activeStages.slice(0, -1).map((stage, index) => {
                const StageIcon = stage.icon;
                const isCompleted = index < currentStageIndex || (isComplete && index <= currentStageIndex);
                const isCurrent = index === currentStageIndex && !isComplete;
                
                return (
                  <div
                    key={stage.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: isCurrent 
                        ? 'rgba(25, 113, 194, 0.1)' 
                        : isCompleted 
                        ? 'rgba(81, 207, 102, 0.1)' 
                        : 'rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isCompleted 
                          ? '#51cf66' 
                          : isCurrent 
                          ? '#1971c2' 
                          : '#e9ecef'
                      }}
                    >
                      {isCompleted ? (
                        <IconCheck size={14} color="white" />
                      ) : (
                        <StageIcon 
                          size={14} 
                          color={isCurrent ? 'white' : '#868e96'} 
                        />
                      )}
                    </div>
                    <Text 
                      size="sm" 
                      fw={isCurrent ? 500 : 400}
                      c={isCompleted ? 'green' : isCurrent ? 'blue' : 'dimmed'}
                    >
                      {stage.title}
                    </Text>
                  </div>
                );
              })}
            </Stack>
          </div>
        </Stack>
      </div>
    </div>
  );
};