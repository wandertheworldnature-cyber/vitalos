import { CheckCircle, Star, Award } from 'lucide-react'

interface Props {
  qualifications?: string
  registrationNumber?: string
  yearsExperience?: number
  verified?: boolean
  avgRating?: number
  totalReviews?: number
}

export default function DoctorCredentials({
  qualifications, registrationNumber, yearsExperience, verified, avgRating, totalReviews
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      {verified && (
        <span className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
          <CheckCircle size={10} /> Verified
        </span>
      )}
      {avgRating ? (
        <span className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
          <Star size={10} fill="currentColor" /> {avgRating.toFixed(1)} ({totalReviews || 0})
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
