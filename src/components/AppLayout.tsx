import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import AIChat from './AIChat'

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      {/* AI Chat floats over all pages */}
      <AIChat />
    </div>
  )
}
