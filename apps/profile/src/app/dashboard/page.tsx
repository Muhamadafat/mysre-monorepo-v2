/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import {
  Grid,
  Card,
  Text,
  Group,
  Avatar,
  Stack,
  Badge,
  ActionIcon,
  Title,
  SimpleGrid,
  Progress,
  RingProgress,
  Center,
  ThemeIcon,
  Box,
} from '@mantine/core';
import {
  IconUsers,
  IconTrendingUp,
  IconEye,
  IconArrowUpRight,
  IconSchool,
  IconFileText,
  IconCalendar,
  IconBrain,
  IconPencil,
  IconBulb,
  IconStar,
  IconRocket,
  IconConfetti,
  IconSparkles,
} from '@tabler/icons-react';
import { usePageAnalytics } from '@/hooks/use-analytics';

// Define interfaces sesuai dengan Prisma schema
interface User {
  id: string;
  name: string | null;
  email: string;
  role: 'USER' | 'ADMIN';
  group?: string | null;
  nim?: string | null;
  avatar_url?: string | null;
  createdAt: Date;
}

interface Article {
  id: string;
  title: string;
  userId: string | null;
  createdAt: Date;
  author?: User;
}

interface DashboardStats {
  totalUsers: number;
  totalAdmins: number;
  totalStudents: number;
  totalGroupA: number;
  totalGroupB: number;
  totalArticles: number;
  adminArticles: number;
  studentArticles: number;
  recentUsers: User[];
  recentArticles: Article[];
  userGrowth: number;
  totalBrainProjects: number;
  totalDrafts: number;
  avgProductivityScore: number;
  highEngagementUsers: number;
  activitiesLast24h: number;
}

// ── Animated Counter Hook ──────────────────────────
function useAnimatedCounter(target: number, duration = 1500, delay = 0) {
  const [count, setCount] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    const timer = setTimeout(() => {
      startedRef.current = true;
      const start = performance.now();
      const step = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutExpo
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        setCount(Math.floor(eased * target));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(timer);
  }, [target, duration, delay]);

  return count;
}

// ── Floating Particles Component ──────────────────
function FloatingParticles({ count = 8, color = 'rgba(255,255,255,0.6)' }: { count?: number; color?: string }) {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    size: Math.random() * 8 + 4,
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: Math.random() * 4,
    duration: Math.random() * 3 + 3,
    emoji: ['⭐', '✨', '💫', '🌟', '🎉', '🎊', '🌈', '💎', '🔮', '🎶'][i % 10],
  }));

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            fontSize: `${p.size + 8}px`,
            animation: `floatDot${(p.id % 3) + 1} ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
            opacity: 0.7,
          }}
        >
          {p.emoji}
        </div>
      ))}
    </div>
  );
}

// ── Shooting Stars Component ──────────────────────
function ShootingStars() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {/* Shooting star 1 */}
      <div
        className="shooting-star"
        style={{
          position: 'absolute',
          top: '20%',
          left: 0,
          width: 80,
          height: 2,
          background: 'linear-gradient(90deg, transparent, white, transparent)',
          borderRadius: 2,
        }}
      />
      {/* Shooting star 2 */}
      <div
        className="shooting-star-2"
        style={{
          position: 'absolute',
          top: '60%',
          left: 0,
          width: 60,
          height: 1.5,
          background: 'linear-gradient(90deg, transparent, rgba(255,220,100,0.9), transparent)',
          borderRadius: 2,
        }}
      />
    </div>
  );
}

// ── Confetti Burst Component ──────────────────────
function ConfettiBurst({ active }: { active: boolean }) {
  const pieces = ['🎊', '🎉', '✨', '⭐', '💫', '🌟', '🎈', '🎁'];
  if (!active) return null;
  return (
    <div style={{ position: 'absolute', top: -10, right: 20, pointerEvents: 'none', zIndex: 10 }}>
      {pieces.map((piece, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            fontSize: '18px',
            animation: `confettiFall 2s ease-in forwards`,
            animationDelay: `${i * 0.15}s`,
            left: `${i * 12}px`,
            top: 0,
          }}
        >
          {piece}
        </div>
      ))}
    </div>
  );
}

// ── Ripple Rings for Ring Progress ────────────────
function RippleRings() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: -5 - i * 8,
            borderRadius: '50%',
            border: `2px solid rgba(255,255,255,${0.3 - i * 0.08})`,
            animation: `rippleExpand 3s ease-out infinite`,
            animationDelay: `${i}s`,
          }}
        />
      ))}
    </>
  );
}

// ── Stat Card with fun animations ─────────────────
function AnimatedStatCard({
  label,
  value,
  labelColor,
  subtitle,
  subtitleColor = 'green',
  icon,
  imageSrc,
  imageAlt,
  entryClass,
  highlightEmoji,
  accentColor,
}: {
  label: string;
  value: number;
  labelColor: string;
  subtitle: React.ReactNode;
  subtitleColor?: string;
  icon?: React.ReactNode;
  imageSrc: string;
  imageAlt: string;
  entryClass: string;
  highlightEmoji: string;
  accentColor: string;
}) {
  const [hovered, setHovered] = useState(false);
  const animated = useAnimatedCounter(value, 1200, parseInt(entryClass.slice(-1)) * 150);

  return (
    <Card
      withBorder
      shadow="sm"
      radius="xl"
      p="lg"
      className={`card-hover-lift ${entryClass}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        overflow: 'visible',
        position: 'relative',
        border: hovered ? `2px solid ${accentColor}40` : '1px solid #e9ecef',
        transition: 'border 0.3s ease',
        background: hovered
          ? `linear-gradient(135deg, white 0%, ${accentColor}08 100%)`
          : 'white',
      }}
    >
      {/* Sparkle emoji top-left when hovered */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            top: -12,
            left: 12,
            fontSize: 20,
            animation: 'tada 1s ease-in-out infinite',
            zIndex: 5,
          }}
        >
          {highlightEmoji}
        </div>
      )}

      <Text size="xs" fw={800} tt="uppercase" mb={4} style={{ color: labelColor }}>
        {label}
      </Text>

      {/* Animated counter number */}
      <Text
        fw={800}
        size="3xl"
        className="stat-number animate-wave-num"
        style={{ color: '#1a1b41', display: 'inline-block' }}
      >
        {animated}
      </Text>

      <Group gap={4} mt="md">
        {subtitle}
      </Group>

      {/* Floating image with animation */}
      <Box
        pos="absolute"
        right={-10}
        bottom={-10}
        w={90}
        h={90}
        style={{ zIndex: 2 }}
        className={hovered ? 'animate-bounce-spring' : 'animate-float'}
      >
        <Image src={imageSrc} alt={imageAlt} layout="fill" objectFit="contain" />
      </Box>
    </Card>
  );
}

export default function DashboardPage() {
  // Auto-track page analytics
  usePageAnalytics('dashboard-home');

  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalAdmins: 0,
    totalStudents: 0,
    totalGroupA: 0,
    totalGroupB: 0,
    totalArticles: 0,
    adminArticles: 0,
    studentArticles: 0,
    recentUsers: [],
    recentArticles: [],
    userGrowth: 0,
    totalBrainProjects: 0,
    totalDrafts: 0,
    avgProductivityScore: 0,
    highEngagementUsers: 0,
    activitiesLast24h: 0,
  });

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [greetingEmoji, setGreetingEmoji] = useState('👋');

  // Cycling greeting emojis
  useEffect(() => {
    const emojis = ['👋', '🎉', '🚀', '✨', '🌟', '💪', '🎓', '🔬'];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % emojis.length;
      setGreetingEmoji(emojis[idx]);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Fetch current user data
  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data && data.user) {
        setCurrentUser(data.user);
        // Trigger confetti burst on load!
        setTimeout(() => {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
        }, 800);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const [usersRes, articlesRes, analyticsRes] = await Promise.all([
        fetch('/api/dashboard/users'),
        fetch('/api/dashboard/articles'),
        fetch('/api/analytics/summary'),
      ]);

      const usersData = await usersRes.json();
      const articlesData = await articlesRes.json();
      const analyticsData = await analyticsRes.json();

      const totalUsers = usersData.totalUsers || 0;
      const totalAdmins = usersData.totalAdmins || 0;
      const totalStudents = usersData.totalStudents || 0;
      const totalGroupA = usersData.totalGroupA || 0;
      const totalGroupB = usersData.totalGroupB || 0;
      const recentUsers = usersData.recentUsers || [];
      const userGrowth = usersData.userGrowth || 0;

      const totalArticles = articlesData.totalArticles || 0;
      const recentArticles = articlesData.recentArticles || [];

      let analyticsStats = {
        totalBrainProjects: 0,
        totalDrafts: 0,
        avgProductivityScore: 75.1,
        highEngagementUsers: 0,
        activitiesLast24h: 0,
      };

      try {
        if (analyticsData && analyticsData.length > 0) {
          const totalAnalytics = analyticsData.reduce(
            (acc: any, item: any) => {
              acc.totalBrainProjects += item.analytics.brainStats.totalProjects;
              acc.totalDrafts += item.analytics.writerStats.totalDrafts;
              acc.avgProductivityScore +=
                item.analytics.overallStats.productivityScore;
              if (item.analytics.overallStats.engagementLevel === 'high') {
                acc.highEngagementUsers++;
              }
              acc.activitiesLast24h +=
                item.analytics.overallStats.recentActivity;
              return acc;
            },
            {
              totalBrainProjects: 0,
              totalDrafts: 0,
              avgProductivityScore: 0,
              highEngagementUsers: 0,
              activitiesLast24h: 0,
            }
          );

          if (analyticsData.length > 0) {
            totalAnalytics.avgProductivityScore =
              totalAnalytics.avgProductivityScore / analyticsData.length;
          }

          analyticsStats = totalAnalytics;
        }
      } catch (analyticsError) {
        console.log('Analytics not available, using mock data');
      }

      setStats({
        totalUsers,
        totalAdmins,
        totalStudents,
        totalGroupA,
        totalGroupB,
        totalArticles,
        adminArticles: 0,
        studentArticles: 0,
        recentUsers,
        recentArticles,
        userGrowth,
        ...analyticsStats,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Center h={200}>
        <Stack align="center">
          {/* Fun loading animation */}
          <div style={{ fontSize: 48, animation: 'bounceSprings 1s ease-in-out infinite' }}>
            🔬
          </div>
          <Title order={3} c="gray.6" style={{ animation: 'waveNum 1.5s ease-in-out infinite' }}>
            Loading Dashboard...
          </Title>
          <Group gap="xs">
            {['🌟', '✨', '💫'].map((s, i) => (
              <span
                key={i}
                style={{
                  fontSize: 20,
                  animation: `twinkle ${1 + i * 0.3}s ease-in-out infinite`,
                  animationDelay: `${i * 0.2}s`,
                }}
              >
                {s}
              </span>
            ))}
          </Group>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="xl" style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '12px' }}>

      {/* ── Inline animation styles ──────────────── */}
      <style>{`
        @keyframes floatFemaleChar {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          30% { transform: translateY(-12px) rotate(2deg); }
          70% { transform: translateY(-6px) rotate(-1deg); }
        }
        .floating-female { animation: floatFemaleChar 4s ease-in-out infinite; }
        
        @keyframes emojiCycle {
          0%, 80%, 100% { transform: scale(1) rotate(0deg); }
          10% { transform: scale(1.3) rotate(-10deg); }
          20% { transform: scale(1.3) rotate(10deg); }
        }
        .emoji-animated { 
          display: inline-block; 
          animation: emojiCycle 2s ease-in-out infinite; 
          cursor: default;
        }

        @keyframes shimmerText {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .shimmer-name {
          background: linear-gradient(90deg, #667eea, #a855f7, #ec4899, #667eea);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmerText 3s linear infinite;
        }

        @keyframes badgePop {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08) rotate(1deg); }
        }
        .badge-pop { animation: badgePop 2.5s ease-in-out infinite; }

        @keyframes dotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.6; }
        }
        .growth-dot { animation: dotPulse 1.5s ease-in-out infinite; display: inline-block; }

        @keyframes trophyBounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          30% { transform: translateY(-12px) rotate(-5deg); }
          60% { transform: translateY(-6px) rotate(5deg); }
        }
        .trophy-anim { animation: trophyBounce 3s ease-in-out infinite; }

        @keyframes hatWiggle {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-8px) rotate(8deg); }
          75% { transform: translateY(-4px) rotate(-8deg); }
        }
        .hat-anim { animation: hatWiggle 2.5s ease-in-out infinite; }

        @keyframes avatarPop {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.1) translateY(-4px); }
        }
        .avatar-pop { animation: avatarPop 2s ease-in-out infinite; }
        .avatar-pop:nth-child(2) { animation-delay: 0.3s; }
        .avatar-pop:nth-child(3) { animation-delay: 0.6s; }
        .avatar-pop:nth-child(4) { animation-delay: 0.9s; }

        @keyframes progressPulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
        .progress-pulse { animation: progressPulse 2s ease-in-out infinite; }

        @keyframes rippleRing {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(2); opacity: 0; }
        }
      `}</style>

      {/* ── Header with animated greeting ─────────── */}
      <Group justify="space-between" className="card-entry-1">
        <div style={{ position: 'relative' }}>
          <Title order={2} fw={800} style={{ color: '#1a1b41' }}>
            Selamat datang kembali,{' '}
            <span className="shimmer-name">{currentUser?.name || 'User'}</span>!{' '}
            <span className="emoji-animated" style={{ fontSize: '1.2em' }}>
              {greetingEmoji}
            </span>
          </Title>
          <Text c="gray.6" mt={4}>
            Berikut ringkasan platform MySRE Anda hari ini.{' '}
            <span style={{ animation: 'twinkle 1.5s ease-in-out infinite', display: 'inline-block' }}>✨</span>
          </Text>

          {/* Confetti burst on load */}
          <ConfettiBurst active={showConfetti} />
        </div>
        <Group>
          <Badge
            size="lg"
            radius="md"
            leftSection={<IconCalendar size={14} />}
            variant="outline"
            color="violet"
            className="badge-pop"
            style={{ backgroundColor: 'white' }}
          >
            {new Date().toLocaleDateString('id-ID', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Badge>
        </Group>
      </Group>

      {/* ── Overview Cards (4 cols) ────────────────── */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
        {/* Card 1: Jumlah Mahasiswa */}
        <AnimatedStatCard
          label="JUMLAH MAHASISWA"
          value={stats.totalStudents}
          labelColor="#7c3aed"
          imageSrc="/images/animasi%20yang%20ditaro%20untuk%20tampilan%20jumlah%20mahasiswa%20pada%20dasbord.png"
          imageAlt="Students"
          entryClass="card-entry-1"
          highlightEmoji="🎓"
          accentColor="#7c3aed"
          subtitle={
            <>
              <span className="bounce-arrow" style={{ display: 'inline-block', animation: 'bounceArrow 1s ease-in-out infinite' }}>
                <IconArrowUpRight size={14} color="green" />
              </span>
              <Text c="green.7" size="xs" fw={600}>
                {stats.userGrowth.toFixed(0)}%
              </Text>
              <Text c="gray.5" size="xs">
                dari minggu lalu
              </Text>
            </>
          }
        />

        {/* Card 2: Total Artikel */}
        <AnimatedStatCard
          label="TOTAL ARTIKEL"
          value={stats.totalArticles}
          labelColor="#2563eb"
          imageSrc="/images/animasi%20yang%20ditaro%20untuk%20tampilan%20total%20artikel%20pada%20dasbord.png"
          imageAlt="Articles"
          entryClass="card-entry-2"
          highlightEmoji="📄"
          accentColor="#2563eb"
          subtitle={
            <>
              <span style={{ display: 'inline-block', animation: 'bounceArrow 1s ease-in-out infinite 0.2s' }}>
                <IconArrowUpRight size={14} color="green" />
              </span>
              <Text c="green.7" size="xs" fw={600}>5%</Text>
              <Text c="gray.5" size="xs">dari bulan lalu</Text>
            </>
          }
        />

        {/* Card 3: Proyek Otak */}
        <AnimatedStatCard
          label="PROYEK OTAK"
          value={stats.totalBrainProjects}
          labelColor="#16a34a"
          imageSrc="/images/animasi%20yang%20ditaro%20untuk%20tampilan%20proyek%20otak%20pada%20dasbord.png"
          imageAlt="Brain Projects"
          entryClass="card-entry-3"
          highlightEmoji="🧠"
          accentColor="#16a34a"
          subtitle={
            <>
              <Box
                w={8} h={8}
                className="growth-dot"
                style={{ borderRadius: '50%', backgroundColor: '#40c057', display: 'inline-block' }}
              />
              <Text c="gray.6" size="xs">Ide brainstorming aktif</Text>
            </>
          }
        />

        {/* Card 4: Draf Total */}
        <AnimatedStatCard
          label="DRAF TOTAL"
          value={stats.totalDrafts}
          labelColor="#ea580c"
          imageSrc="/images/animasi%20yang%20ditaro%20untuk%20tampilan%20draf%20total%20pada%20dasbord.png"
          imageAlt="Drafts"
          entryClass="card-entry-4"
          highlightEmoji="📝"
          accentColor="#ea580c"
          subtitle={
            <>
              <span style={{ display: 'inline-block', animation: 'bounceArrow 1s ease-in-out infinite 0.4s' }}>
                <IconArrowUpRight size={14} color="orange" />
              </span>
              <Text c="gray.6" size="xs">Perlu dalam penyaringan</Text>
            </>
          }
        />
      </SimpleGrid>

      {/* ── Hero Banner: Gambaran Umum Analisis ─────── */}
      <Card
        shadow="md"
        radius="xl"
        p={0}
        className="card-entry-5"
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
          backgroundSize: '200% 200%',
          animation: 'gradientShift 6s ease infinite',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '220px',
        }}
      >
        {/* Animated background particles */}
        <FloatingParticles count={8} />

        {/* Shooting stars */}
        <ShootingStars />

        {/* Decorative circles */}
        <div style={{
          position: 'absolute', right: -40, top: -40,
          width: 200, height: 200, borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
          animation: 'ringSpin 20s linear infinite',
        }} />
        <div style={{
          position: 'absolute', left: -20, bottom: -30,
          width: 150, height: 150, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          animation: 'ringSpin 15s linear infinite reverse',
        }} />

        <Box p="xl" style={{ position: 'relative', zIndex: 2 }}>
          <Group mb="xl">
            <ThemeIcon variant="transparent" c="white" size="md">
              <IconTrendingUp
                size={24}
                style={{ animation: 'bounceArrow 1.5s ease-in-out infinite' }}
              />
            </ThemeIcon>
            <Title order={3} fw={600} style={{ color: 'white' }}>
              Gambaran Umum Analisis Pembelajaran{' '}
              <span style={{ animation: 'tada 2s ease-in-out infinite', display: 'inline-block' }}>📊</span>
            </Title>
          </Group>

          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xl" w={{ base: '100%', md: '60%' }}>
            {[
              {
                label: 'Produktivitas Rata-rata',
                value: `${stats.avgProductivityScore.toFixed(1)}%`,
                points: '0,15 20,10 40,18 60,5 80,12 100,2',
                stroke: 'white',
              },
              {
                label: 'Keterlibatan Tinggi',
                value: `${stats.highEngagementUsers}`,
                points: '0,18 20,15 40,16 60,10 80,12 100,5',
                stroke: '#63e6be',
              },
              {
                label: 'Draf per Siswa',
                value: stats.totalStudents > 0
                  ? (stats.totalDrafts / stats.totalStudents).toFixed(1)
                  : '0',
                points: '0,10 20,12 40,8 60,15 80,5 100,2',
                stroke: '#a9e34b',
              },
              {
                label: 'Tingkat Ketercapaian',
                value: `${stats.totalStudents > 0
                  ? ((stats.highEngagementUsers / stats.totalStudents) * 100).toFixed(1)
                  : '0'}%`,
                points: '0,12 20,8 40,10 60,15 80,18 100,5',
                stroke: '#ffd43b',
              },
            ].map((item, i) => (
              <div key={i} style={{ animation: `slideInUp 0.5s ease-out ${0.2 + i * 0.1}s both` }}>
                <Text size="xs" style={{ opacity: 0.9 }}>{item.label}</Text>
                <Text
                  size="2xl"
                  fw={700}
                  mt={4}
                  style={{ animation: `waveNum 2s ease-in-out ${i * 0.3}s infinite`, display: 'inline-block' }}
                >
                  {item.value}
                </Text>
                <Box mt="xs" h={20} style={{ position: 'relative' }}>
                  <svg
                    viewBox="0 0 100 20"
                    preserveAspectRatio="none"
                    style={{ width: '100%', height: '100%', stroke: item.stroke, strokeWidth: 2, fill: 'none', opacity: 0.8 }}
                  >
                    <polyline points={item.points} />
                  </svg>
                </Box>
              </div>
            ))}
          </SimpleGrid>
        </Box>

        {/* Floating female character */}
        <style>{`
          @keyframes floatFemaleChar {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
          .floating-female { animation: floatFemaleChar 3.5s ease-in-out infinite; }
        `}</style>
        <Box pos="absolute" right={180} bottom={0} w={220} h={230} style={{ zIndex: 1 }} className="floating-female">
          <Image
            src="/images/animasi%20tampilan%20dasbord%20(perempuan).png"
            alt="Female Researcher"
            layout="fill"
            objectFit="contain"
            objectPosition="bottom"
          />
        </Box>

        {/* Circular Progress with ripple */}
        <Box pos="absolute" right={40} top={40} style={{ zIndex: 2 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {/* Ripple rings behind ring progress */}
            <div style={{
              position: 'absolute', inset: -8, borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.3)',
              animation: 'rippleExpand 3s ease-out infinite',
            }} />
            <div style={{
              position: 'absolute', inset: -8, borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.2)',
              animation: 'rippleExpand 3s ease-out infinite',
              animationDelay: '1s',
            }} />
            <RingProgress
              size={140}
              thickness={12}
              roundCaps
              sections={[{ value: stats.avgProductivityScore, color: 'white' }]}
              rootColor="rgba(255, 255, 255, 0.2)"
              label={
                <Center>
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{ fontSize: '24px', fontWeight: 800, color: 'white', animation: 'heartbeat 2s ease-in-out infinite' }}
                    >
                      {stats.avgProductivityScore.toFixed(0)}%
                    </div>
                    <div style={{ fontSize: '10px', opacity: 0.9, color: 'white' }}>
                      Produktivitas
                    </div>
                  </div>
                </Center>
              }
            />
          </div>
        </Box>
      </Card>

      {/* ── Two columns: Pengguna & Artikel ──────────── */}
      <Grid gutter="lg">
        {/* Left: Pengguna Terbaru */}
        <Grid.Col span={{ base: 12, lg: 5 }} className="card-entry-5">
          <Card
            withBorder
            shadow="sm"
            radius="xl"
            p="xl"
            h="100%"
            className="card-hover-lift"
            style={{ position: 'relative', overflow: 'hidden' }}
          >
            {/* Subtle floating sparkles in background */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              {['🌟', '✨', '💫', '⭐'].map((s, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    fontSize: '16px',
                    opacity: 0.15,
                    left: `${20 + i * 20}%`,
                    top: `${10 + i * 15}%`,
                    animation: `twinkle ${2 + i * 0.5}s ease-in-out infinite`,
                    animationDelay: `${i * 0.4}s`,
                  }}
                >
                  {s}
                </div>
              ))}
            </div>

            <Group justify="space-between" mb="xl">
              <Title order={4} fw={700}>
                Pengguna Terbaru{' '}
                <span style={{ animation: 'wiggle 2s ease-in-out infinite', display: 'inline-block', fontSize: '1em' }}>
                  👥
                </span>
              </Title>
              <Group gap="xs">
                <Badge size="md" variant="light" color="blue" radius="sm" className="badge-pop">
                  {stats.totalStudents} SISWA
                </Badge>
                <ActionIcon variant="subtle" color="gray">
                  <IconEye size={18} />
                </ActionIcon>
              </Group>
            </Group>

            <Group gap="sm" mt="lg">
              {stats.recentUsers.length > 0 ? (
                <Avatar.Group spacing="sm">
                  {stats.recentUsers.slice(0, 4).map((user, i) => (
                    <Avatar
                      key={user.id}
                      src={user.avatar_url || undefined}
                      radius="xl"
                      size="lg"
                      color="blue"
                      className="avatar-pop"
                      style={{
                        animation: `avatarPop 2s ease-in-out infinite`,
                        animationDelay: `${i * 0.3}s`,
                        border: '2px solid #667eea',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </Avatar>
                  ))}
                  {stats.recentUsers.length > 4 && (
                    <Avatar radius="xl" size="lg" color="gray" variant="light" style={{ fontWeight: 700 }}>
                      +{stats.recentUsers.length - 4}
                    </Avatar>
                  )}
                </Avatar.Group>
              ) : (
                <Text c="gray.5" size="sm" mt="xs">
                  Belum ada pengguna baru dalam 7 hari terakhir
                </Text>
              )}
            </Group>

            {/* Animated sparkle decoration */}
            <Box pos="absolute" bottom={20} right={20}>
              <Text
                size="xl"
                c="violet"
                style={{ animation: 'tada 3s ease-in-out infinite', display: 'inline-block', fontSize: '28px' }}
              >
                ✨
              </Text>
            </Box>
          </Card>
        </Grid.Col>

        {/* Right: Artikel Terbaru */}
        <Grid.Col span={{ base: 12, lg: 7 }} className="card-entry-6">
          <Card
            withBorder
            shadow="sm"
            radius="xl"
            p="xl"
            h="100%"
            className="card-hover-lift"
            style={{ position: 'relative' }}
          >
            <Group justify="space-between" mb="lg">
              <Title order={4} fw={700}>
                Artikel Terbaru{' '}
                <span style={{ animation: 'heartbeat 2s ease-in-out infinite', display: 'inline-block' }}>📰</span>
              </Title>
              <Text c="blue.6" size="sm" fw={600} style={{ cursor: 'pointer', animation: 'bounceArrow 1.5s ease-in-out infinite' }}>
                Lihat Semua →
              </Text>
            </Group>

            <Stack gap="md" pr={50}>
              {stats.recentArticles.length > 0 ? (
                stats.recentArticles.slice(0, 4).map((article, i) => (
                  <Group
                    wrap="nowrap"
                    align="flex-start"
                    key={article.id}
                    style={{
                      animation: `slideInLeft 0.4s ease-out ${i * 0.1}s both`,
                      padding: '8px',
                      borderRadius: '8px',
                      transition: 'background 0.2s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(102,126,234,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <ThemeIcon
                      variant="light"
                      color="violet"
                      size="lg"
                      radius="md"
                      style={{ animation: `floatUpDown 3s ease-in-out ${i * 0.5}s infinite`, flexShrink: 0 }}
                    >
                      <IconFileText size={18} />
                    </ThemeIcon>
                    <Box style={{ flex: 1 }}>
                      <Text size="sm" fw={600} lineClamp={2}>{article.title}</Text>
                      <Text size="xs" c="gray.5">
                        {article.author?.name || 'Siswa'} •{' '}
                        {new Date(article.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </Text>
                    </Box>
                    <Badge color="violet" variant="light" radius="sm">Draft</Badge>
                  </Group>
                ))
              ) : (
                <Text c="gray.5" size="sm" py="xl">
                  Belum ada artikel yang dipublikasikan
                </Text>
              )}
            </Stack>

            <Text
              c="blue.6"
              size="sm"
              fw={600}
              mt="lg"
              style={{ cursor: 'pointer', animation: 'bounceArrow 1.5s ease-in-out infinite', display: 'inline-block' }}
            >
              Lihat Semua Artikel →
            </Text>

            {/* Trophy with bounce animation */}
            <Box
              pos="absolute"
              right={20}
              bottom={20}
              w={60}
              h={60}
              className="trophy-anim"
            >
              <Image
                src="/images/animasi%20piala%20untuk%20tampilan%20dasbord.png"
                alt="Trophy"
                layout="fill"
                objectFit="contain"
              />
            </Box>
          </Card>
        </Grid.Col>
      </Grid>

      {/* ── Bottom: Distribusi Grup Mahasiswa ──────── */}
      <Card
        withBorder
        shadow="sm"
        radius="xl"
        p="xl"
        className="card-hover-lift card-entry-6"
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        {/* Animated background blobs */}
        <div style={{
          position: 'absolute',
          width: 150, height: 150,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%)',
          top: -40, right: 100,
          animation: 'floatDot2 6s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        <Group justify="space-between" mb="xl">
          <Title order={4} fw={700}>
            Distribusi Grup Mahasiswa{' '}
            <span style={{ animation: 'wiggle 3s ease-in-out infinite', display: 'inline-block' }}>📊</span>
          </Title>
          <Group gap="xs" style={{ cursor: 'pointer' }}>
            <Text
              c="gray.6"
              size="sm"
              fw={500}
              style={{ transition: 'color 0.2s ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#667eea')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '')}
            >
              Lihat Detail
            </Text>
            <ActionIcon variant="subtle" color="gray" size="sm">
              <IconFileText size={16} />
            </ActionIcon>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={50} pr={100}>
          {/* Grup A */}
          <Box>
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <IconUsers size={16} color="gray" style={{ animation: 'wiggle 3s ease-in-out infinite' }} />
                <Text size="sm" fw={600}>Grup A</Text>
              </Group>
              <Group gap="xs">
                <Text size="sm" c="gray.5" fw={500}>{stats.totalGroupA} mahasiswa</Text>
                <span style={{ fontSize: '14px', animation: 'tada 3s ease-in-out infinite' }}>👩‍🎓</span>
              </Group>
            </Group>
            <div className="progress-pulse">
              <Progress
                value={stats.totalStudents > 0 ? (stats.totalGroupA / stats.totalStudents) * 100 : 0}
                color="violet"
                size="sm"
                radius="xl"
                striped
                animated
              />
            </div>
          </Box>

          {/* Grup B */}
          <Box>
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <IconUsers size={16} color="gray" style={{ animation: 'wiggle 3s ease-in-out infinite 0.5s' }} />
                <Text size="sm" fw={600}>Grup B</Text>
              </Group>
              <Group gap="xs">
                <Text size="sm" c="gray.5" fw={500}>{stats.totalGroupB} mahasiswa</Text>
                <span style={{ fontSize: '14px', animation: 'tada 3s ease-in-out infinite 0.5s' }}>👨‍🎓</span>
              </Group>
            </Group>
            <div className="progress-pulse" style={{ animationDelay: '0.5s' }}>
              <Progress
                value={stats.totalStudents > 0 ? (stats.totalGroupB / stats.totalStudents) * 100 : 0}
                color="orange"
                size="sm"
                radius="xl"
                striped
                animated
              />
            </div>
          </Box>
        </SimpleGrid>

        {/* Graduation hat with wiggle animation */}
        <Box pos="absolute" right={20} bottom={20} w={80} h={80} className="hat-anim">
          <Image
            src="/images/animasi%20toga%20untuk%20tampilan%20dasbord.png"
            alt="Graduation"
            layout="fill"
            objectFit="contain"
          />
        </Box>
      </Card>
    </Stack>
  );
}
