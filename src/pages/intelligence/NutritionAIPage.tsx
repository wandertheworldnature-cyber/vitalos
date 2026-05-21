import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Utensils, Zap, RefreshCw, Brain } from 'lucide-react'
import toast from 'react-hot-toast'

interface MealPlan {
  title: string
  why: string
  breakfast: { meal:string; why:string; calories:number }
  lunch: { meal:string; why:string; calories:number }
  dinner: { meal:string; why:string; calories:number }
  snacks: string[]
  avoid: string[]
  supplements: string[]
  dailyTarget: { calories:number; protein:number; carbs:number; fat:number; fiber:number }
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export default function NutritionAIPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [mealPlan, setMealPlan] = useState<MealPlan|null>(null)
  const [context, setContext] = useState({ records:[], profile: null as {age?:number;gender?:string;weight?:string;height?:string;conditions?:string}|null, gutScore:0, fitnessGoal:'general health' })
  const [goal, setGoal] = useState('general health')

  useEffect(()=>{ if(user) loadContext() },[user])

  async function loadContext() {
    if(!user) return
    const [records, profile, gut] = await Promise.all([
      supabase.from('health_records').select('test_name,value,unit,reference_min,reference_max')
        .eq('user_id',user.id).order('recorded_at',{ascending:false}).limit(40),
      supabase.from('profiles').select('date_of_birth,gender,weight,height,known_conditions').eq('id',user.id).single(),
      supabase.from('health_records').select('value').eq('user_id',user.id).eq('test_name','Gut Health Score').order('recorded_at',{ascending:false}).limit(1),
    ])
    let age: number|undefined
    if(profile.data?.date_of_birth) age=Math.floor((Date.now()-new Date(profile.data.date_of_birth).getTime())/31557600000)
    setContext({
      records: (records.data||[]) as [],
      profile: { age, gender:profile.data?.gender, weight:profile.data?.weight, height:profile.data?.height, conditions:profile.data?.known_conditions },
      gutScore: (gut.data?.[0] as {value?:number}|undefined)?.value||0,
      fitnessGoal: goal,
    })
  }

  async function generate() {
    if(!user) return
    const key = import.meta.env.VITE_GROQ_API_KEY
    if(!key||key.includes('your-groq')) { toast.error('Add VITE_GROQ_API_KEY to Vercel env vars'); return }
    setLoading(true)
    try {
      const recStr = (context.records as Array<{test_name:string;value:number;unit:string;reference_max?:number|null}>).map(r=>{
        const hi = r.reference_max&&r.value>r.reference_max?' [HIGH]':''
        return `${r.test_name}: ${r.value} ${r.unit}${hi}`
      }).join('\n')
      const res = await fetch(GROQ_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
        body:JSON.stringify({
          model:'llama-3.3-70b-versatile',
          messages:[{
            role:'user',
            content:`You are a clinical nutritionist AI for VitalOS, an Indian health platform.

Patient profile:
- Age: ${context.profile?.age||'Unknown'}, Gender: ${context.profile?.gender||'Unknown'}
- Weight: ${context.profile?.weight||'Unknown'} kg, Height: ${context.profile?.height||'Unknown'} cm
- Known conditions: ${context.profile?.conditions||'None'}
- Gut health score: ${context.gutScore}/100
- Fitness goal: ${goal}

Lab results:
${recStr||'No lab data'}

Create a personalized 1-day Indian meal plan. Use common Indian foods (dal, sabzi, roti, rice, curd, etc).
Address specific deficiencies and risks from the lab data.

Return ONLY valid JSON:
{
  "title": "Plan name based on their needs",
  "why": "Why this plan suits them specifically (2 sentences)",
  "breakfast": {"meal":"specific Indian meal","why":"how it helps their specific labs","calories":350},
  "lunch": {"meal":"specific Indian meal","why":"how it helps","calories":550},
  "dinner": {"meal":"specific Indian meal","why":"how it helps","calories":450},
  "snacks": ["snack 1 with benefit","snack 2 with benefit"],
  "avoid": ["food to avoid and why","food 2 and why"],
  "supplements": ["supplement if needed","supplement 2"],
  "dailyTarget": {"calories":1800,"protein":80,"carbs":220,"fat":60,"fiber":28}
}`
          }],
          max_tokens:1500, temperature:0.4,
          response_format:{type:'json_object'},
        })
      })
      if(!res.ok) throw new Error('API error')
      const data = await res.json() as {choices:Array<{message:{content:string}}>}
      const plan = JSON.parse(data.choices[0].message.content) as MealPlan
      setMealPlan(plan)
      toast.success('Personalized meal plan ready!')
    } catch { toast.error('Generation failed — check API key') }
    finally { setLoading(false) }
  }

  const GOALS = ['general health','lose weight','build muscle','manage diabetes','improve energy','heart health','gut healing']

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="card !p-5" style={{background:'linear-gradient(135deg,#052e16,#14532d)',borderColor:'#166534'}}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(34,197,94,0.2)'}}>
            <Utensils size={24} className="text-green-400"/>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Personalized Nutrition AI</h1>
              <span className="text-[10px] bg-green-900 text-green-300 border border-green-700 px-2 py-0.5 rounded-full font-bold">AI-powered</span>
            </div>
            <p className="text-sm text-green-300">Meal plans based on your blood markers, gut health, and goals. 100% Indian foods.</p>
          </div>
        </div>
      </div>

      <div className="card !p-4">
        <p className="text-sm font-bold text-gray-800 mb-3">Your goal</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {GOALS.map(g=>(
            <button key={g} onClick={()=>setGoal(g)}
              className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${goal===g?'text-white border-transparent':'border-gray-200 text-gray-500'}`}
              style={goal===g?{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}:{}}>
              {g}
            </button>
          ))}
        </div>
        <button onClick={generate} disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          <Brain size={16}/>{loading?'Creating your plan...':'Generate my meal plan'}
        </button>
      </div>

      {mealPlan && (
        <>
          <div className="card !p-4" style={{background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',borderColor:'#a7f3d0'}}>
            <p className="text-base font-black text-green-800">{mealPlan.title}</p>
            <p className="text-sm text-green-700 mt-1">{mealPlan.why}</p>
            <div className="grid grid-cols-5 gap-2 mt-3">
              {[
                {label:'Calories',val:`${mealPlan.dailyTarget?.calories}`,unit:'kcal'},
                {label:'Protein', val:`${mealPlan.dailyTarget?.protein}`,unit:'g'},
                {label:'Carbs',   val:`${mealPlan.dailyTarget?.carbs}`,unit:'g'},
                {label:'Fat',     val:`${mealPlan.dailyTarget?.fat}`,unit:'g'},
                {label:'Fiber',   val:`${mealPlan.dailyTarget?.fiber}`,unit:'g'},
              ].map(m=>(
                <div key={m.label} className="bg-white/60 rounded-lg p-2 text-center">
                  <div className="text-sm font-black text-green-700">{m.val}</div>
                  <div className="text-[9px] text-gray-500">{m.unit}</div>
                  <div className="text-[9px] text-gray-400">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {[
            {time:'🌅 Breakfast', data:mealPlan.breakfast},
            {time:'☀️ Lunch',     data:mealPlan.lunch},
            {time:'🌙 Dinner',    data:mealPlan.dinner},
          ].map(({time,data})=>(
            <div key={time} className="card !p-4">
              <div className="flex items-start justify-between mb-1">
                <p className="text-sm font-bold text-gray-900">{time}</p>
                <span className="text-xs text-gray-400 font-medium">{data?.calories} kcal</span>
              </div>
              <p className="text-sm font-semibold text-gray-800 mb-1">{data?.meal}</p>
              <p className="text-xs text-teal-600 flex gap-1.5"><Zap size={11} className="mt-0.5 shrink-0"/>{data?.why}</p>
            </div>
          ))}

          {mealPlan.snacks?.length>0 && (
            <div className="card !p-4">
              <p className="text-sm font-bold text-gray-800 mb-2">🥜 Healthy snacks</p>
              {mealPlan.snacks.map((s,i)=><p key={i} className="text-xs text-gray-600 mb-1 flex gap-1.5"><span className="text-amber-500">•</span>{s}</p>)}
            </div>
          )}

          <div className="card !p-4">
            <p className="text-sm font-bold text-gray-800 mb-2">🚫 Avoid this week</p>
            {mealPlan.avoid?.map((a,i)=><p key={i} className="text-xs text-red-600 mb-1 flex gap-1.5"><span>•</span>{a}</p>)}
          </div>

          {mealPlan.supplements?.length>0 && (
            <div className="card !p-4">
              <p className="text-sm font-bold text-gray-800 mb-2">💊 Consider these supplements</p>
              {mealPlan.supplements.map((s,i)=><p key={i} className="text-xs text-teal-600 mb-1 flex gap-1.5"><span>✓</span>{s}</p>)}
              <p className="text-[10px] text-gray-400 mt-2">Always consult your doctor before starting supplements.</p>
            </div>
          )}

          <button onClick={generate} disabled={loading} className="w-full btn-secondary text-xs py-2 flex items-center justify-center gap-2">
            <RefreshCw size={12}/> Regenerate plan
          </button>
        </>
      )}
    </div>
  )
}
