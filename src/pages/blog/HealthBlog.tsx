import { useState } from 'react'
import { BookOpen, Clock, ChevronRight, Search, TrendingUp, Heart, Brain, Utensils, Moon, Dumbbell, X } from 'lucide-react'

interface Article {
  id: string
  title: string
  excerpt: string
  content: string
  category: string
  readTime: string
  icon: string
  featured?: boolean
}

const CATEGORIES = [
  { key: 'all',        label: 'All',        icon: BookOpen },
  { key: 'diabetes',   label: 'Diabetes',   icon: TrendingUp },
  { key: 'heart',      label: 'Heart',      icon: Heart },
  { key: 'mental',     label: 'Mental',     icon: Brain },
  { key: 'nutrition',  label: 'Nutrition',  icon: Utensils },
  { key: 'sleep',      label: 'Sleep',      icon: Moon },
  { key: 'fitness',    label: 'Fitness',    icon: Dumbbell },
]

const ARTICLES: Article[] = [
  {
    id: 'a1', category: 'diabetes', featured: true, readTime: '5 min', icon: '🩸',
    title: 'Why India Has 101 Million Diabetics — And How to Not Become One',
    excerpt: 'India is the diabetes capital of the world. Understand your risk factors and the exact lifestyle changes that cut risk by 58%.',
    content: `India has more people living with diabetes than any country except China — an estimated 101 million adults, with another 136 million pre-diabetic.

**Why Indians are especially vulnerable:**
- Genetic predisposition — Indians develop diabetes at lower BMI than Western populations
- "Thin-fat" phenotype — normal weight but high body fat percentage, especially visceral fat
- Diet high in refined carbs (white rice, maida) with rapid urbanization
- Sedentary lifestyle from desk jobs and increased screen time

**The numbers that matter for you:**
- Fasting glucose 70-99 mg/dL = Normal
- Fasting glucose 100-125 mg/dL = Pre-diabetes (reversible!)
- Fasting glucose 126+ mg/dL = Diabetes
- HbA1c under 5.7% = Normal, 5.7-6.4% = Pre-diabetes, 6.5%+ = Diabetes

**The Diabetes Prevention Program (landmark US study) found:**
Lifestyle intervention reduced diabetes risk by 58% — more effective than medication (31% reduction). The intervention was simple:; 150 minutes of moderate exercise per week, 7% body weight loss, and dietary changes.

**Practical steps for Indian diets:**
1. Replace white rice with brown rice or reduce portion by half
2. Walk 10-15 minutes after each meal — this alone can lower post-meal glucose spikes by 12%
3. Add protein and fiber before carbs in each meal (dal before rice, salad before roti)
4. Get HbA1c tested annually after age 30, or earlier with family history

If you've already uploaded lab reports to VitalOS, check your Biomarker Analytics section — we'll flag if your glucose trend is moving in the wrong direction before it becomes diabetes.`,
  },
  {
    id: 'a2', category: 'heart', readTime: '4 min', icon: '❤️',
    title: 'The Silent Heart Attack Risk Most Indians Ignore: LDL Cholesterol',
    excerpt: 'Heart disease strikes Indians a decade earlier than Western populations. Here\'s what your lipid profile is really telling you.',
    content: `Indians develop coronary artery disease 5-10 years earlier than people in Western countries, and heart attacks below age 40 are alarmingly common.

**The LDL cholesterol targets that actually matter:**
- General population: LDL under 100 mg/dL
- With diabetes or existing heart disease: LDL under 70 mg/dL
- Every 1% drop in LDL reduces heart attack risk by roughly 1%

**Why South Asians are higher risk:**
- Higher Lipoprotein(a) — a genetic risk factor rarely tested for
- Lower HDL ("good cholesterol") on average
- Higher triglycerides even at normal weight
- Central obesity (belly fat) more common even in thin people

**What actually moves the needle:**
1. Soluble fiber — 5-10g daily (oats, beans, apples) can lower LDL by 5-10%
2. Replace saturated fats (ghee, butter in excess) with unsaturated (mustard oil, groundnut oil in moderation)
3. 150 min/week of brisk walking raises HDL significantly
4. Quit smoking — single biggest reversible risk factor, HDL improves within weeks of quitting

**Get tested if you're:**
- Male over 40, female over 45
- Have a family history of early heart disease
- Diabetic or pre-diabetic
- Have high blood pressure

Check your Biomarker Analytics in VitalOS — we track LDL, HDL, and triglycerides against Indian-specific optimal ranges, not just the generic "normal" lab range.`,
  },
  {
    id: 'a3', category: 'mental', readTime: '6 min', icon: '🧠',
    title: 'Burnout Isn\'t Laziness: Recognizing the Warning Signs Early',
    excerpt: 'India\'s work culture normalizes exhaustion. Learn to spot burnout before it becomes a health crisis.',
    content: `Burnout is now recognized by the WHO as an occupational phenomenon — not a personal failing, but a legitimate health condition resulting from chronic unmanaged workplace stress.

**The three core signs:**
1. Emotional exhaustion — feeling drained even after rest
2. Cynicism/detachment — increasing negativity about work or relationships
3. Reduced sense of accomplishment — feeling ineffective despite effort

**Why it hits Indian professionals hard:**
- Average work week significantly longer than global standards in many sectors
- Cultural pressure to appear constantly "available" and hardworking
- Poor work-life boundaries, especially with remote/hybrid work
- Stigma around discussing mental health openly

**The physical toll:**
Chronic stress elevates cortisol, which over time:
- Disrupts sleep quality (even if you're "sleeping" 7-8 hours)
- Raises blood pressure and resting heart rate
- Increases abdominal fat storage
- Weakens immune response

**Early intervention that works:**
1. Track your mood, energy, and stress daily — patterns become visible after just 1-2 weeks
2. Protect one full day per week with zero work obligations
3. 10 minutes of daily meditation reduces cortisol measurably within 8 weeks
4. Talk to someone — a therapist, doctor, or trusted person — before it becomes a crisis

If your VitalOS Mental Health OS score has been trending toward "moderate" or "high" burnout risk, that's not something to push through — it's your data asking you to make a change.`,
  },
  {
    id: 'a4', category: 'nutrition', readTime: '4 min', icon: '🥗',
    title: 'Vitamin D Deficiency: Why Sunny India Has an Epidemic',
    excerpt: 'Counterintuitively, over 70% of Indians are Vitamin D deficient despite abundant sunshine. Here\'s why.',
    content: `Despite India's abundant sunlight, studies show 70-90% of the population is Vitamin D deficient. This seems paradoxical until you understand the actual causes.

**Why deficiency is so common:**
- Darker skin requires more sun exposure to produce the same Vitamin D
- Urban lifestyles mean less direct sun exposure — most sunlight hours are spent indoors or commuting
- Air pollution blocks UVB rays needed for synthesis
- Cultural practices of covering skin, and heavy sunscreen use
- Vegetarian diets lack Vitamin D-rich foods (fatty fish, egg yolks)

**The optimal range (not just "normal"):**
- Deficient: under 20 ng/mL
- Insufficient: 20-29 ng/mL
- Sufficient: 30-100 ng/mL
- Optimal for Indians specifically: 40-80 ng/mL

**Symptoms often mistaken for something else:**
- Chronic fatigue and low energy
- Bone and joint pain
- Frequent infections/weak immunity
- Low mood, especially in winter months

**Fixing it:**
1. 15-20 minutes of midday sun exposure (arms and legs, no sunscreen) 3-4 times a week
2. D3 supplementation — 1000-2000 IU daily is common for maintenance, higher doses under medical guidance for correction
3. Retest after 3 months of supplementation to confirm levels are rising

Your VitalOS Biomarker Analytics will flag Vitamin D against this Indian-optimal range — not the generic Western lab reference range which is often set lower.`,
  },
  {
    id: 'a5', category: 'sleep', readTime: '5 min', icon: '😴',
    title: 'The 7-Hour Myth: What Quality Sleep Actually Requires',
    excerpt: 'Sleep duration alone doesn\'t tell the full story. Here\'s what your sleep is really doing for your body.',
    content: `"Sleep 7-9 hours" is common advice, but duration alone misses half the picture. Sleep quality and consistency matter just as much.

**What happens during sleep that duration alone doesn't capture:**
- Deep sleep (stages 3-4): Physical repair, growth hormone release, immune strengthening
- REM sleep: Memory consolidation, emotional processing
- Consistent sleep-wake timing regulates your circadian rhythm, which affects metabolism, hormone release, and mood

**Why irregular sleep hurts even if duration is adequate:**
Sleeping 6 hours one night and 9 the next disrupts your body's internal clock similarly to jet lag — even though the average might look like "7.5 hours."

**Signs your sleep quality needs attention (even at 7-8 hours):**
- Waking up tired despite adequate hours
- Needing caffeine to function by mid-morning
- Difficulty concentrating despite "enough" sleep
- Frequent waking during the night

**Evidence-based fixes:**
1. Same wake-up time every day (including weekends) — this is more important than bedtime
2. No screens 1 hour before bed — blue light delays melatonin release by up to 3 hours
3. Room temperature 18-20°C is optimal for deep sleep
4. Avoid caffeine after 2 PM — it has a 5-6 hour half-life

Track your sleep in VitalOS Sleep Intelligence — we look at consistency and correlate it with your mood and energy data, not just raw hours.`,
  },
  {
    id: 'a6', category: 'fitness', readTime: '4 min', icon: '🏃',
    title: 'Why "No Pain No Gain" Is Costing You Recovery',
    excerpt: 'Overtraining without recovery doesn\'t build fitness faster — it often reverses your progress. Here\'s the science.',
    content: `The "no pain no gain" mentality, especially popular in Indian gym culture, often works against the very fitness goals people are chasing.

**What actually happens during exercise:**
Training creates controlled damage to muscle fibers. The *adaptation* — getting stronger, fitter, faster — happens during recovery, not during the workout itself. Train without adequate recovery, and you accumulate fatigue without adaptation.

**Signs of inadequate recovery (overtraining):**
- Resting heart rate elevated by 5+ bpm from your baseline
- Persistent muscle soreness beyond 72 hours
- Declining performance despite consistent training
- Increased injury frequency
- Mood disturbances, irritability

**What good recovery actually requires:**
1. Sleep — the single most important recovery tool; muscle protein synthesis peaks during deep sleep
2. Protein intake — roughly 1.6-2.2g per kg bodyweight for those strength training regularly
3. Rest days — at least 1-2 full rest days per week, more during high-intensity blocks
4. Active recovery — light walking or yoga on rest days improves blood flow without adding stress

**The readiness principle:**
Your body's readiness to train hard varies day to day based on sleep, stress, and prior training load. Training at 100% intensity every single day, regardless of readiness, is how injuries and plateaus happen.

VitalOS Fitness & Recovery Ecosystem calculates your daily readiness score based on recent training load — use it to decide whether today is a push day or a recovery day.`,
  },
]

export default function HealthBlog() {
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Article | null>(null)

  const filtered = ARTICLES.filter(a => {
    const matchCat = category === 'all' || a.category === category
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.excerpt.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })
  const featured = ARTICLES.find(a => a.featured)

  if (selected) {
    return (
      <div className="p-4 pb-8 max-w-2xl mx-auto">
        <button onClick={() => setSelected(null)} className="text-xs text-teal-600 font-semibold mb-4 flex items-center gap-1">
          ← Back to articles
        </button>
        <div className="card !p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-3xl">{selected.icon}</span>
            <div>
              <span className="text-[10px] text-teal-600 font-bold uppercase">{selected.category}</span>
              <p className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={9}/>{selected.readTime} read</p>
            </div>
          </div>
          <h1 className="text-xl font-black text-gray-900 mb-4 leading-tight">{selected.title}</h1>
          <div className="prose prose-sm max-w-none">
            {selected.content.split('\n\n').map((para, i) => {
              if (para.startsWith('**') && para.endsWith('**')) {
                return <p key={i} className="text-sm font-bold text-gray-800 mt-4 mb-2">{para.replace(/\*\*/g, '')}</p>
              }
              if (para.match(/^\d\./)) {
                return <p key={i} className="text-sm text-gray-600 leading-relaxed mb-1">{para}</p>
              }
              if (para.startsWith('- ')) {
                return <p key={i} className="text-sm text-gray-600 leading-relaxed mb-1">{para}</p>
              }
              return <p key={i} className="text-sm text-gray-600 leading-relaxed mb-3">{para}</p>
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="card !p-5" style={{ background: 'linear-gradient(135deg,#0f2a1e,#1a3a2a)', borderColor: '#166534' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(34,197,94,0.15)' }}>
            <BookOpen size={24} className="text-green-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white mb-1">Health Library</h1>
            <p className="text-sm text-green-300">Evidence-based articles on preventive health, written for the Indian context.</p>
          </div>
        </div>
      </div>

      <input className="input text-sm" placeholder="Search articles..." value={search} onChange={e => setSearch(e.target.value)}
        style={{ paddingLeft: 36 }} />

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map(c => {
          const Icon = c.icon
          return (
            <button key={c.key} onClick={() => setCategory(c.key)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap font-semibold flex-shrink-0 transition-colors ${category === c.key ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500'}`}>
              <Icon size={11} />{c.label}
            </button>
          )
        })}
      </div>

      {category === 'all' && !search && featured && (
        <button onClick={() => setSelected(featured)} className="card !p-5 w-full text-left hover:shadow-md transition-all"
          style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', borderColor: '#a7f3d0' }}>
          <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">FEATURED</span>
          <div className="flex items-center gap-2 mt-2 mb-1">
            <span className="text-2xl">{featured.icon}</span>
            <p className="text-[10px] text-emerald-600 font-bold uppercase">{featured.category} · {featured.readTime}</p>
          </div>
          <p className="text-base font-black text-gray-900 mb-1 leading-snug">{featured.title}</p>
          <p className="text-xs text-gray-600">{featured.excerpt}</p>
        </button>
      )}

      <div className="space-y-3">
        {filtered.filter(a => !(category === 'all' && !search && a.featured)).map(a => (
          <button key={a.id} onClick={() => setSelected(a)} className="card !p-4 w-full text-left hover:shadow-md transition-all">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-teal-600 font-bold uppercase mb-0.5">{a.category} · {a.readTime}</p>
                <p className="text-sm font-bold text-gray-900 mb-1 leading-snug">{a.title}</p>
                <p className="text-xs text-gray-500 line-clamp-2">{a.excerpt}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 shrink-0 mt-1" />
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card border-dashed border-2 text-center py-10">
          <Search size={28} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No articles found</p>
        </div>
      )}
    </div>
  )
}

