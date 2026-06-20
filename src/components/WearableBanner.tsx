import { useNavigate } from 'react-router-dom'
import { Watch, ChevronRight } from 'lucide-react'

export default function WearableBanner() {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate('/wearables')}
      className="cursor-pointer rounded-2xl p-4 border transition-all hover:shadow-md hover:-translate-y-0.5"
      style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', borderColor: '#bfdbfe' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Watch size={16} className="text-blue-600" />
          <span className="text-sm font-bold text-blue-900">Wearable sync</span>
          <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">LIVE</span>
        </div>
        <ChevronRight size={16} className="text-blue-400" />
      </div>
      <p className="text-xs text-blue-700 mb-3">
        Sync health data from Apple Watch, Samsung, Fitbit, Garmin, Noise, boAt and 70+ more wearables.
      </p>
      <div className="flex gap-2">
        {[
          { icon: '⌚', label: 'Apple Watch',    platform: 'iOS'     },
          { icon: '🤖', label: 'Health Connect', platform: 'Android' },
          { icon: '💚', label: 'Fitbit',          platform: 'Both'    },
          { icon: '🔵', label: 'Samsung',         platform: 'Android' },
        ].map(d => (
          <div key={d.label} className="flex-1 bg-white/70 rounded-xl p-2 text-center border border-blue-100">
            <div className="text-base mb-0.5">{d.icon}</div>
            <div className="text-[9px] font-semibold text-blue-800 truncate">{d.label}</div>
            <div className="text-[8px] text-blue-500">{d.platform}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-blue-600">
        <Watch size={12} /> Tap to connect your wearable →
      </div>
    </div>
  )
}
