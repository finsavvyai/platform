import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Header } from '@/components/layout/header'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Redirect to login if not authenticated
  if (!session) {
    redirect('/auth/signin')
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <AppSidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto bg-background">
            <div className="h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
