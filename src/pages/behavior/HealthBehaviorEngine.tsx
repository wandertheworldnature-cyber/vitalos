import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Trophy, Flame, Target, Lock, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const CHALLENGES = [
  { id:'c1', title:'10K Steps Streak',    desc:'Walk 10,000 steps every day for 7 days',        icon:'🚶', days:7,  pts:500,  diff:'medium', cat:'fitness'   },
  { id:'c2', title:'Sleep Champion',      desc:'Sleep 8 hours every night for 7 days',           icon:'😴', days:7,  pts:400,  diff:'medium', cat:'sleep'     },
  { id:'c3', title:'Sugar Detox',         desc:'Log zero sugary drinks for 14 days',             icon:'🚫', days:14, pts:800,  diff:'hard',   cat:'nutrition' },
  { id:'c4', title:'Hydration Hero',      desc:'Drink 8 glasses of water daily for 7 days',      icon:'💧', days:7,  pts:300,  diff:'easy',   cat:'wellness'  },
  { id:'c5', title:'Meditation Streak',   desc:'Meditate 10 minutes daily for 14 days',          icon:'🧘', days:14, pts:600,  diff:'medium', cat:'mental'    },
  { id:'c6', title:'Workout Warrior',     desc:'Complete 5 workouts in one week',                icon:'💪', days:7,  pts:600,  diff:'hard',   cat:'fitness'   },
  { id:'c7', title:'Vegetable Champion',  desc:'Eat 5 servings of vegetables daily for 7 days',  icon:'🥗', days:7,  pts:400,  diff:'medium', cat:'nutrition' },
  { id:'c8', title:'No Screen After 10PM',desc:'No screens 1 hour before bed for 7 days',       icon:'📵', days:7,  pts:400,  diff:'hard',   cat:'sleep'     },
]

const BADGES = [
  { id:'first',   icon:'👣', label:'First Step',  desc:'Complete first challenge' },
  { id:'warrior', icon:'💪', label:'Warrior',     desc:'Complete 5 challenges'    },
  { id:'streak',  icon:'🔥', label:'On Fire',     desc:'7-day streak'             },
  { id:'sleep',   icon:'😴', label:'Sleep Master',desc:'8hrs sleep for 7 days'    },
  { id:'data',    icon:'📊', label:'Data Driven', desc:'Upload 5 lab reports'     },
  { id:'social',  icon:'👥', label:'Social Hero', desc:'Invite 3 friends'         },
]

const DIFF: Record<string,string> = { easy:'bg-emerald-100 text-emerald-700', medium:'bg-amber-100 text-amber-700', hard:'bg-red-100 text-red-700' }

export default function HealthBehaviorEngine() {
  const { user } = useAuthStore()
  const [points, setPoints] = useState(0)
  const [joined, setJoined] = useState<Set<string>>(new Set())
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'challenges'|'leaderboard'|'badges'>('challenges')
  const [filter, setFilter] = useState('all')
  const [logging, setLogging] = useState<string|null>(null)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    const { data } = await supabase.from('health_records').select('metadata,value')
      .eq('user_id', user.id).eq('record_type','behavior_challenge')
    const j = new Set<string>(); const c = new Set<string>(); let pts = 0
    ;(data||[]).forEach((r:Record<string,unknown>)=>{
      const m = r.metadata as Record<string,unknown>
      if (m?.challenge_id) { j.add(m.challenge_id as string); if (m.completed) { c.add(m.challenge_id as string); pts += (r.value as number)||0 } }
    })
    setJoined(j); setCompleted(c); setPoints(pts)
  }

  async function joinChallenge(c: typeof CHALLENGES[0]) {
    if (!user) return
    await supabase.from('health_records').insert({
      user_id:user.id, record_type:'behavior_challenge', test_name:c.title,
      value:0, unit:'pts', source:'manual', recorded_at:new Date().toISOString(),
      metadata:{ challenge_id:c.id, progress:0, completed:false, joined_at:new Date().toISOString() }
    })
    toast.success(`🎯 Joined "${c.title}"!`)
    load()
  }

  async function logProgress(c: typeof CHALLENGES[0]) {
    if (!user) return
    setLogging(c.id)
    try {
      const { data:existing } = await supabase.from('health_records').select('id,metadata')
        .eq('user_id', user.id).eq('record_type','behavior_challenge')
        .filter('metadata->>challenge_id','eq',c.id).single()
      if (existing) {
        const prev = ((existing.metadata as Record<string,unknown>)?.progress as number)||0
        const newProg = Math.min(100, prev + Math.round(100/c.days))
        const done = newProg >= 100
        await supabase.from('health_records').update({
          value: done ? c.pts : newProg,
          metadata:{ challenge_id:c.id, progress:newProg, completed:done, last_logged:new Date().toISOString() }
        }).eq('id', existing.id)
        if (done) toast.success(`🎉 Challenge complete! +${c.pts} pts!`)
        else toast.success(`Progress: ${newProg}%`)
        load()
      }
    } finally { setLogging(null) }
  }

  const level = points < 500 ? 'Beginner' : points < 1500 ? 'Seeker' : points < 3000 ? 'Warrior' : points < 5000 ? 'Hunter' : 'Legend'
  const filtered = filter==='all' ? CHALLENGES : CHALLENGES.filter(c=>c.cat===filter)

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="card !p-5" style={{background:'linear-gradient(135deg,#1c0533,#2d0a4e)',borderColor:'#7c3aed'}}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(139,92,246,0.2)'}}>
            <Trophy size={24} className="text-purple-400"/>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Health Challenges</h1>
              <span className="text-[10px] bg-purple-900 text-purple-300 border border-purple-700 px-2 py-0.5 rounded-full font-bold">Gamified</span>
            </div>
            <p className="text-sm text-purple-300">Streaks · Rewards · Challenges · Badges</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[['Points',points],['Level',level],['Done',completed.size]].map(([l,v])=>(
            <div key={String(l)} className="text-center bg-white/10 rounded-lg p-2">
              <div className="text-base font-black text-white">{v}</div>
              <div className="text-[9px] text-purple-300">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['challenges','leaderboard','badges'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`flex-1 text-xs py-2 rounded-lg font-semibold capitalize ${tab===t?'bg-white shadow-sm text-gray-900':'text-gray-500'}`}>
            {t==='challenges'?'🎯 Challenges':t==='leaderboard'?'🏆 Leaderboard':'🎖️ Badges'}
          </button>
        ))}
      </div>

      {tab==='challenges' && <>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {['all','fitness','sleep','nutrition','mental','wellness'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap font-semibold flex-shrink-0 capitalize ${filter===f?'bg-gray-900 text-white border-gray-900':'border-gray-200 text-gray-500'}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {filtered.map(c=>(
            <div key={c.id} className="card !p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{c.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-bold text-gray-900">{c.title}</p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${DIFF[c.diff]}`}>{c.diff}</span>
                    {completed.has(c.id) && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">✓ Done</span>}
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{c.desc}</p>
                  <div className="flex gap-3 text-xs text-gray-400">
                    <span>{c.days} days</span>
                    <span className="text-amber-600 font-bold">+{c.pts} pts</span>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                {!joined.has(c.id) && !completed.has(c.id) && (
                  <button onClick={()=>joinChallenge(c)} className="w-full py-2 rounded-xl text-xs font-bold text-white" style={{background:'linear-gradient(135deg,#7c3aed,#8b5cf6)'}}>
                    Join challenge →
                  </button>
                )}
                {joined.has(c.id) && !completed.has(c.id) && (
                  <button onClick={()=>logProgress(c)} disabled={logging===c.id} className="w-full py-2 rounded-xl text-xs font-bold text-white" style={{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}}>
                    {logging===c.id?'Logging...':'Log today\'s progress ✓'}
                  </button>
                )}
                {completed.has(c.id) && (
                  <div className="w-full py-2 rounded-xl text-xs font-bold text-emerald-600 bg-emerald-50 text-center">✅ Completed!</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </>}

      {tab==='leaderboard' && (
        <div className="card !p-5">
          <p className="text-sm font-bold text-gray-800 mb-4">🏆 Community leaderboard</p>
          {[{r:1,n:'You',p:points,badge:'🏆'},{r:2,n:'Priya S.',p:4200,badge:'🥈'},{r:3,n:'Rahul K.',p:3800,badge:'🥉'},{r:4,n:'Anita R.',p:3200,badge:'⭐'},{r:5,n:'Vikram S.',p:2900,badge:'⭐'}]
            .sort((a,b)=>b.p-a.p)
            .map((l,i)=>(
              <div key={l.r} className={`flex items-center gap-3 p-3 rounded-xl mb-2 last:mb-0 ${l.n==='You'?'bg-purple-50 border border-purple-100':''}`}>
                <span className="text-xl shrink-0">{l.badge}</span>
                <p className="text-sm font-bold text-gray-900 flex-1">{l.n}{l.n==='You'&&<span className="text-[10px] text-purple-600 ml-1">(you)</span>}</p>
                <span className="text-sm font-black text-purple-600">{l.p.toLocaleString()} pts</span>
              </div>
            ))}
        </div>
      )}

      {tab==='badges' && (
        <div className="card !p-5">
          <p className="text-sm font-bold text-gray-800 mb-4">Your badges</p>
          <div className="grid grid-cols-3 gap-3">
            {BADGES.map(b=>{
              const earned = b.id==='first' ? completed.size>0 : b.id==='warrior' ? completed.size>=5 : false
              return (
                <div key={b.id} className={`text-center p-3 rounded-xl border ${earned?'bg-amber-50 border-amber-100':'bg-gray-50 border-gray-100 opacity-50'}`}>
                  <div className="text-3xl mb-1">{b.icon}</div>
                  <p className="text-[11px] font-bold text-gray-800">{b.label}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{b.desc}</p>
                  {!earned&&<Lock size={10} className="text-gray-300 mx-auto mt-1"/>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

