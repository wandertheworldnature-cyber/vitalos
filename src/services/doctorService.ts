import { supabase } from '@/lib/supabase'
import type { Doctor, Appointment } from '@/types'

export async function getDoctors(specialty?: string): Promise<Doctor[]> {
  let query = supabase
    .from('doctors')
    .select('*')
    .eq('is_active', true)
    .order('rating', { ascending: false })

  if (specialty && specialty !== 'All') {
    query = query.ilike('specialty', `%${specialty}%`)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data || []) as Doctor[]).map(doc => ({
    ...doc,
    available_slots: generateSlots(),
  }))
}

function generateSlots() {
  const slots = []
  const times = ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00']
  const today = new Date()

  for (let d = 1; d <= 7; d++) {
    const date = new Date(today)
    date.setDate(today.getDate() + d)
    if (date.getDay() === 0) continue // skip Sundays

    const dateStr = date.toISOString().split('T')[0]
    for (const time of times) {
      if (Math.random() > 0.4) {
        slots.push({
          id: `${dateStr}-${time}`,
          date: dateStr,
          time,
          available: true,
        })
      }
    }
  }
  return slots
}

export async function bookAppointment(
  userId: string,
  doctorId: string,
  date: string,
  time: string,
  notes?: string
): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      user_id: userId,
      doctor_id: doctorId,
      slot_date: date,
      slot_time: time,
      notes,
      status: 'scheduled',
      meeting_link: `https://meet.vitalos.in/room/${Math.random().toString(36).slice(2, 9)}`,
    })
    .select('*, doctor:doctors(*)')
    .single()

  if (error) throw error
  return data as unknown as Appointment
}

export async function getAppointments(userId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, doctor:doctors(*)')
    .eq('user_id', userId)
    .order('slot_date', { ascending: true })

  if (error) throw error
  return (data || []) as unknown as Appointment[]
}

export async function cancelAppointment(appointmentId: string): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', appointmentId)
  if (error) throw error
}
