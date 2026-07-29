import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Gift, Users, Copy, Check, Share2, Trophy, Zap, ChevronRight, Star } from 'lucide-react'
import toast from 'react-hot-toast'

interface ReferralStats {
  code: string
  totalInvited: number
  totalJoined: number
  pointsEarned: number
  pendingRewards: number
}

interface ReferredUser { name: string; joinedDate: string; status: 'pending' | 'joined' | 'active'; pointsAwarded: number }

const REWARD_TIERS = [
  { invites: 1,  reward: '100 points',           icon: '🎁' },
  { invites: 3,  reward: '500 points + badge',    icon: '🏅' },
  { invites: 5,  reward: '1 month Pro free',      icon: '⭐' },
  { invites: 10, reward: '3 months Pro free',     icon: '👑' },
  { invites: 25, reward: 'Lifetime Pro + ₹500',   icon: '💎' },
]

function generateReferralCode(userId: string, name?: string): string {
  const prefix = (name || 'USER').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase()
  const suffix = userId.replace(/-/g, '').slice(0, 5).toUpperCase()
  return `${prefix}${suffix}`
}

export default function ReferralProgram() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [referred, setReferred] = useState<ReferredUser[]>([])
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  const referralLink = stats ? `https://vitalos-six.vercel.app/signup?ref=${stats.code}` : ''

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    setLoading(true)
    // Check if user has a referral code, generate if not
    const { data: profile } = await supabase.from('profiles').select('referral_code, referral_stats').eq('id', user.id).single()

    let code = profile?.referral_code
    if (!code) {
      code = generateReferralCode(user.id, user.full_name)
      await supabase.from('profiles').update({ referral_code: code }).eq('id', user.id)
    }

    // Load who used this referral code
    const { data: referredUsers } = await supabase.from('profiles')
      .select('full_name, created_at').eq('referred_by', code)
      .order('created_at', { ascending: false })

    const savedStats = profile?.referral_stats as { pointsEarned?: number } | null
    setStats({
      code,
      totalInvited: (referredUsers || []).length,
      totalJoined: (referredUsers || []).length,
      pointsEarned: savedStats?.pointsEarned || (referredUsers || []).length * 100,
      pendingRewards: 0,
    })
    setReferred((referredUsers || []).map((r: { full_name: string; created_at: string }) => ({
      name: r.full_name || 'New user', joinedDate: r.created_at, status: 'joined', pointsAwarded: 100
    })))
    setLoading(false)
  }

  function copyLink() {
    navigator.clipboard?.writeText(referralLink)
    setCopied(true)
    toast.success('Referral link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  function shareWhatsApp() {
    const msg = `Hey! I've been using VitalOS to track my health — AI insights, lab report analysis, doctor bookings, all in one app. Join using my link and we both get rewards!\n\n${referralLink}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function shareNative() {
    if (navigator.share) {
      navigator.share({ title: 'Join VitalOS', text: 'Track your health with AI — join me on VitalOS!', url: referralLink })
    } else copyLink()
  }

  if (loading || !stats) return <div className="p-8 text-center text-gray-400">Loading...</div>

  const nextTier = REWARD_TIERS.find(t => t.invites > stats.totalJoined) || REWARD_TIERS[REWARD_TIERS.length - 1]
  const progress = Math.min(100, (stats.totalJoined / nextTier.invites) * 100)

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="card !p-5" style={{ background: 'linear-gradient(135deg,#1c0533,#2d0a4e)', borderColor: '#7c3aed' }}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(139,92,246,0.2)' }}>
            <Gift size={24} className="text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Invite & Earn</h1>
              <span className="text-[10px] bg-purple-900 text-purple-300 border border-purple-700 px-2 py-0.5 rounded-full font-bold">NEW</span>
            </div>
            <p className="text-sm text-purple-300">Invite friends to VitalOS — you both earn rewards when they join.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[['Invited', stats.totalInvited], ['Joined', stats.totalJoined], ['Points', stats.pointsEarned]].map(([l, v]) => (
            <div key={l} className="text-center bg-white/10 rounded-lg p-2">
              <div className="text-lg font-black text-white">{v}</div>
              <div className="text-[9px] text-purple-300">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Referral link card */}
      <div className="card !p-5">
        <p className="text-sm font-bold text-gray-800 mb-3">Your referral link</p>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3 mb-3">
          <code className="flex-1 text-xs text-teal-600 truncate font-mono">{referralLink}</code>
          <button onClick={copyLink} className="shrink-0 text-teal-600 p-1.5 hover:bg-teal-50 rounded-lg">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={shareWhatsApp} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 flex items-center justify-center gap-2">
            📲 Share on WhatsApp
          </button>
          <button onClick={shareNative} className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-700 border border-gray-200 flex items-center gap-2">
            <Share2 size={15} />
          </button>
        </div>
        <div className="mt-3 bg-purple-50 rounded-lg p-2.5 text-center">
          <p className="text-xs text-purple-700">Your code: <span className="font-black font-mono">{stats.code}</span></p>
        </div>
      </div>

      {/* Reward tiers progress */}
      <div className="card !p-5">
        <p className="text-sm font-bold text-gray-800 mb-3">Reward tiers</p>
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>{stats.totalJoined} friends joined</span>
            <span>Next: {nextTier.reward}</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#7c3aed,#a78bfa)' }} />
          </div>
        </div>
        <div className="space-y-2">
          {REWARD_TIERS.map(t => (
            <div key={t.invites} className={`flex items-center gap-3 p-2.5 rounded-xl ${stats.totalJoined >= t.invites ? 'bg-emerald-50 border border-emerald-100' : 'bg-gray-50'}`}>
              <span className="text-xl shrink-0">{t.icon}</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-gray-800">{t.invites} invite{t.invites > 1 ? 's' : ''}</p>
                <p className="text-xs text-gray-500">{t.reward}</p>
              </div>
              {stats.totalJoined >= t.invites && <Check size={16} className="text-emerald-500 shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Referred users list */}
      {referred.length > 0 && (
        <div className="card !p-5">
          <p className="text-sm font-bold text-gray-800 mb-3">People you invited</p>
          <div className="space-y-2">
            {referred.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)' }}>
                    {r.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                    <p className="text-[10px] text-gray-400">{new Date(r.joinedDate).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-purple-600">+{r.pointsAwarded} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {referred.length === 0 && (
        <div className="card border-dashed border-2 text-center py-10">
          <Users size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600 mb-1">No invites yet</p>
          <p className="text-xs text-gray-400 mb-4">Share your link to start earning rewards</p>
          <button onClick={shareWhatsApp} className="btn-primary text-xs py-2">Share on WhatsApp</button>
        </div>
      )}
    </div>
  )
}
