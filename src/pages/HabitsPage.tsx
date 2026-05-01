import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { CheckCircle, Circle, Flame, Trophy, Star, Droplets, Footprints, Moon, Apple, Heart, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Habit {
  id: string
  name: string
  icon: string
  category: string
  target: string
  points: number
  completed: boolean
  streak: number
}

interface HabitLog {
  habit_id: string
  completed_at: string
  date: string
}

const DEFAULT_HABITS: Omit<Habit, 'completed' | 'streak'>[] = [
  { id: 'water',    name: 'Drink 8 glasses of water', icon: '💧', category: 'hydration',   target: '8 glasses', points: 5 },
  { id: 'steps',    name: 'Walk 8,000 steps',          icon: '🚶', category: 'activity',    target: '8,000 steps',points: 8 },
  { id: 'sleep',    name: 'Sleep 7–8 hours',           icon: '😴', category: 'sleep',       target: '7–8 hrs',   points: 7 },
  { id: 'veggies',  name: 'Eat vegetables/fruits',     icon: '🥗', category: 'nutrition',   target: '3+ servings',points: 6 },
  { id: 'nosugar',  name: 'Avoid sugar today',         icon: '🚫', category: 'nutrition',   target: 'Zero added', points: 8 },
  { id: 'exercise', name: 'Exercise 30 minutes',       icon: '💪', category: 'activity',    target: '30 min',    points: 10 },
  { id: 'meditate', name: 'Meditate / breathe',        icon: '🧘', category: 'mental',      target: '5 min',     points: 5 },
  { id: 'meds',     name: 'Take medications/supplements', icon: '💊', category: 'health',  target: 'As prescribed',points: 6 },
]

const LEVEL_THRESHOLDS = [0,100,250,500,1000,2000,5000]
const LEVEL_NAMES = ['Beginner','Health Seeker','Consistent','Dedicated','Health Champion','Longevity Master','VitalOS Elite']

function getLevel(points: number) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i]) return { level: i + 1, name: LEVEL_NAMES[i], next: LEVEL_THRESHOLDS[i + 1] || null, current: LEVEL_THRESHOLDS[i] }
  }
  return { level: 1, name: LEVEL_NAMES[0], next: LEVEL_THRESHOLDS[1], current: 0 }
}

export default function HabitsPage() {
  const { user } = useAuthStore()
  const [habits, setHabits] = useState<Habit[]>([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [todayPoints, setTodayPoints] = useState(0)
  const [weeklyCompleted, setWeeklyCompleted] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showAddHabit, setShowAddHabit] = useState(false)
  const [newHabitName, setNewHabitName] = useState('')
  const [celebrating, setCelebrating] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { if (user) loadHabits() }, [user])

  const loadHabits = useCallback(async () => {
    if (!user) return
    setLoading(true)

    // Get today's completions
    const { data: todayLogs } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)

    // Get all logs for streak + points
    const { data: allLogs } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(500)

    const completedToday = new Set((todayLogs || []).map((l: HabitLog) => l.habit_id))

    // Calculate streaks
    const streakMap = new Map<string, number>()
    const logsByHabit = new Map<string, string[]>()
    for (const log of (allLogs || []) as HabitLog[]) {
      const arr = logsByHabit.get(log.habit_id) || []
      arr.push(log.date)
      logsByHabit.set(log.habit_id, arr)
    }
    for (const [hid, dates] of logsByHabit) {
      const unique = [...new Set(dates)].sort((a, b) => b.localeCompare(a))
      let streak = 0
      let check = today
      for (const d of unique) {
        if (d === check) { streak++; const dt = new Date(check); dt.setDate(dt.getDate() - 1); check = dt.toISOString().split('T')[0] }
        else break
      }
      streakMap.set(hid, streak)
    }

    // Total points
    const totalPts = (allLogs || []).reduce((sum: number, l: HabitLog & { points?: number }) => sum + (l.points || 5), 0)
    const todayPts = (todayLogs || []).reduce((sum: number, l: HabitLog & { points?: number }) => sum + (l.points || 5), 0)

    // Weekly completions
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
    const weekly = (allLogs || []).filter((l: HabitLog) => new Date(l.date) >= weekAgo).length

    setTotalPoints(totalPts)
    setTodayPoints(todayPts)
    setWeeklyCompleted(weekly)

    setHabits(DEFAULT_HABITS.map(h => ({
      ...h,
      completed: completedToday.has(h.id),
      streak: streakMap.get(h.id) || 0,
    })))

    setLoading(false)
  }, [user, today])

  async function toggleHabit(habit: Habit) {
    if (!user) return
    if (habit.completed) {
      // Uncomplete
      await supabase.from('habit_logs').delete()
        .eq('user_id', user.id).eq('habit_id', habit.id).eq('date', today)
      setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, completed: false } : h))
      setTodayPoints(p => p - habit.points)
    } else {
      // Complete
      await supabase.from('habit_logs').insert({
        user_id: user.id,
        habit_id: habit.id,
        date: today,
        points: habit.points,
        completed_at: new Date().toISOString(),
      })
      setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, completed: true, streak: h.streak + 1 } : h))
      setTodayPoints(p => p + habit.points)
      setTotalPoints(p => p + habit.points)

      // Celebration
      setCelebrating(habit.id)
      setTimeout(() => setCelebrating(null), 1500)

      // Check if all done
      const newCompleted = habits.filter(h => h.completed || h.id === habit.id).length
      if (newCompleted === habits.length) {
        toast.success('🎉 Perfect day! All habits completed! +bonus points', { duration: 4000 })
      }
    }
  }

  const level = getLevel(totalPoints)
  const completedCount = habits.filter(h => h.completed).length
  const progressPct = (completedCount / habits.length) * 100

  const catGroups = habits.reduce((acc, h) => {
    if (!acc[h.category]) acc[h.category] = []
    acc[h.category].push(h)
    return acc
  }, {} as Record<string, Habit[]>)

  const catColors: Record<string, string> = {
    hydration: '#3b82f6', activity: '#10b981', sleep: '#8b5cf6',
    nutrition: '#f59e0b', mental: '#ec4899', health: '#ef4444',
  }

  if (loading) return <div className="p-6"><div className="space-y-3">{[1,2,3].map(i => <div key={i} className="card h-16 animate-pulse bg-gray-100" />)}</div></div>

  return (
    <div className="p-6 max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Flame size={20} className="text-orange-500" /> Daily Health Habits
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Build streaks, earn points, live longer</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {/* Level card */}
        <div className="card col-span-2" style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)', borderColor: '#4338ca' }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs text-indigo-300">Level {level.level}</p>
              <p className="text-base font-bold text-white">{level.name}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-indigo-600/50 flex items-center justify-center">
              <Trophy size={22} className="text-amber-300" />
            </div>
          </div>
          <div className="h-2 bg-indigo-900 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full transition-all"
              style={{ width: level.next ? `${((totalPoints - level.current) / (level.next - level.current)) * 100}%` : '100%' }} />
          </div>
          <p className="text-[10px] text-indigo-400 mt-1">
            {totalPoints.toLocaleString()} pts{level.next ? ` · ${(level.next - totalPoints).toLocaleString()} to next level` : ' · Max level!'}
          </p>
        </div>

        <div className="card text-center">
          <Flame size={22} className="text-orange-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-gray-900">{todayPoints}</p>
          <p className="text-[10px] text-gray-400">Points today</p>
        </div>

        <div className="card text-center">
          <Star size={22} className="text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-gray-900">{weeklyCompleted}</p>
          <p className="text-[10px] text-gray-400">This week</p>
        </div>
      </div>

      {/* Daily progress bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-gray-800">
            Today's progress — {completedCount}/{habits.length} habits
          </p>
          <p className="text-sm font-bold text-teal-600">{Math.round(progressPct)}%</p>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, background: progressPct === 100 ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#0f6e56,#1d9e75)' }} />
        </div>
        {progressPct === 100 && (
          <p className="text-xs text-teal-600 font-bold mt-1.5 text-center">🎉 Perfect day! All habits completed!</p>
        )}
      </div>

      {/* Habits by category */}
      {Object.entries(catGroups).map(([cat, catHabits]) => (
        <div key={cat}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 capitalize flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: catColors[cat] || '#6b7280' }} />
            {cat}
          </p>
          <div className="space-y-2">
            {catHabits.map(habit => (
              <button key={habit.id} onClick={() => toggleHabit(habit)}
                className={`w-full text-left card flex items-center gap-4 transition-all hover:shadow-md active:scale-[0.99] relative overflow-hidden ${
                  habit.completed ? 'border-teal-200' : ''
                } ${celebrating === habit.id ? 'scale-[1.02]' : ''}`}
                style={habit.completed ? { background: 'linear-gradient(135deg,#f0fdf8,#ecfdf5)' } : {}}>

                {/* Completion indicator */}
                {habit.completed
                  ? <CheckCircle size={22} className="text-teal-500 shrink-0" />
                  : <Circle size={22} className="text-gray-300 shrink-0" />
                }

                <span className="text-2xl">{habit.icon}</span>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${habit.completed ? 'text-teal-700 line-through' : 'text-gray-900'}`}>
                    {habit.name}
                  </p>
                  <p className="text-xs text-gray-400">Target: {habit.target}</p>
                </div>

                {/* Streak */}
                {habit.streak > 0 && (
                  <div className="flex items-center gap-1 bg-orange-50 border border-orange-100 px-2 py-1 rounded-lg">
                    <Flame size={12} className="text-orange-500" />
                    <span className="text-xs font-bold text-orange-600">{habit.streak}</span>
                  </div>
                )}

                {/* Points */}
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${habit.completed ? 'bg-teal-100' : 'bg-gray-100'}`}>
                  <Star size={11} className={habit.completed ? 'text-teal-600' : 'text-gray-400'} />
                  <span className={`text-xs font-bold ${habit.completed ? 'text-teal-700' : 'text-gray-500'}`}>+{habit.points}</span>
                </div>

                {/* Celebration burst */}
                {celebrating === habit.id && (
                  <div className="absolute inset-0 bg-teal-400/10 flex items-center justify-center pointer-events-none">
                    <span className="text-3xl animate-bounce">✨</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Motivation footer */}
      <div className="card text-center py-4" style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', borderColor: '#a7f3d0' }}>
        <p className="text-sm font-bold text-emerald-800 mb-1">
          {completedCount === 0 ? '👋 Start your healthy day!' :
           completedCount < habits.length / 2 ? '💪 Keep going!' :
           completedCount < habits.length ? '🔥 Almost there — finish strong!' :
           '🏆 Perfect day! Your future self thanks you!'}
        </p>
        <p className="text-xs text-emerald-600">
          Each habit completed today reduces your disease risk and improves your Longevity Score.
        </p>
      </div>
    </div>
  )
}
