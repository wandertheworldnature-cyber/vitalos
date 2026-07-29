# Add reviews & credentials to DoctorsPage.tsx

## 1. Database setup (run in Supabase SQL Editor):

```sql
CREATE TABLE IF NOT EXISTS doctor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  appointment_id UUID REFERENCES appointments(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE doctor_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reviews" ON doctor_reviews FOR SELECT USING (true);
CREATE POLICY "Users can write their own reviews" ON doctor_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE doctors ADD COLUMN IF NOT EXISTS qualifications TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS years_experience INTEGER;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS avg_rating NUMERIC DEFAULT 0;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;
```

## 2. Add this component to a new file: src/components/DoctorCredentials.tsx

```tsx
import { CheckCircle, Star, Award } from 'lucide-react'

interface Props {
  qualifications?: string
  registrationNumber?: string
  yearsExperience?: number
  verified?: boolean
  avgRating?: number
  totalReviews?: number
}

export default function DoctorCredentials({ qualifications, registrationNumber, yearsExperience, verified, avgRating, totalReviews }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      {verified && (
        <span className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
          <CheckCircle size={10} /> Verified
        </span>
      )}
      {avgRating ? (
        <span className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
          <Star size={10} fill="currentColor" /> {avgRating.toFixed(1)} ({totalReviews})
        </span>
      ) : null}
      {yearsExperience ? (
        <span className="flex items-center gap-1 text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
          <Award size={10} /> {yearsExperience}+ yrs
        </span>
      ) : null}
      {qualifications && <span className="text-[10px] text-gray-400">{qualifications}</span>}
      {registrationNumber && <span className="text-[9px] text-gray-300">Reg: {registrationNumber}</span>}
    </div>
  )
}
```

## 3. In DoctorsPage.tsx, import and use it under each doctor's name:

```tsx
import DoctorCredentials from '@/components/DoctorCredentials'

// Inside the doctor card, after doctor.name and doctor.specialty:
<DoctorCredentials
  qualifications={doctor.qualifications}
  registrationNumber={doctor.registration_number}
  yearsExperience={doctor.years_experience}
  verified={doctor.verified}
  avgRating={doctor.avg_rating}
  totalReviews={doctor.total_reviews}
/>
```

## 4. Add a review submission form after completed appointments (in the appointments tab):

```tsx
// After an appointment with status 'completed', show:
<button onClick={() => setReviewingAppt(appt)} className="text-xs text-amber-600 border border-amber-200 px-3 py-1.5 rounded-lg">
  ⭐ Rate this consultation
</button>

// Modal/form:
{reviewingAppt && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
      <p className="font-bold mb-3">Rate Dr. {reviewingAppt.doctor.name}</p>
      <div className="flex gap-1 justify-center mb-3">
        {[1,2,3,4,5].map(n => (
          <button key={n} onClick={() => setReviewRating(n)}>
            <Star size={28} className={n <= reviewRating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'} />
          </button>
        ))}
      </div>
      <textarea className="input text-sm h-20 mb-3" placeholder="Share your experience (optional)" value={reviewComment} onChange={e=>setReviewComment(e.target.value)} />
      <button onClick={submitReview} className="btn-primary w-full py-2">Submit review</button>
    </div>
  </div>
)}
```

```tsx
async function submitReview() {
  await supabase.from('doctor_reviews').insert({
    doctor_id: reviewingAppt.doctor_id, user_id: user.id,
    appointment_id: reviewingAppt.id, rating: reviewRating, comment: reviewComment
  })
  toast.success('Thanks for your feedback!')
  setReviewingAppt(null)
}
```
