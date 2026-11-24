
"use client";

import React, { useEffect, useState } from 'react';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarInset, useSidebar } from '@/components/ui/sidebar';
import { AppSidebarNav } from './app-sidebar-nav';
import { AppHeader } from './app-header';
import { cn } from '@/lib/utils';
import { Construction, ShieldAlert, Clock } from 'lucide-react';
import Link from 'next/link';
import { AppBottomNav } from './app-bottom-nav';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, signOut } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { format } from 'date-fns';
import { Logo } from './logo';

function SidebarLogo() {
    const { open } = useSidebar();
    return (
        <Link href="/home" className="flex items-center px-2 py-4">
            <Logo size="md" showText={open} />
        </Link>
    )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [user] = useAuthState(auth);
  const pathname = usePathname();
  const router = useRouter();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [suspensionData, setSuspensionData] = useState<{ active: boolean, reason?: string, expires?: Date } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (d) => {
        if (d.exists()) setIsMaintenance(!!d.data().maintenanceMode);
    }, () => {});
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
        setSuspensionData(null);
        return;
    }
    const unsub = onSnapshot(doc(db, 'users', user.uid), (d) => {
        if (d.exists()) {
            const data = d.data();
            const expires = data.suspendsUntil?.toDate();
            const isCurrentlySuspended = !!data.suspended && expires && new Date() < expires;
            
            if (isCurrentlySuspended) {
                setSuspensionData({ 
                    active: true, 
                    reason: data.suspensionReason || "Violation of community standards.",
                    expires: expires
                });
            } else {
                setSuspensionData(null);
            }
        }
    }, () => {});
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const userStatusRef = doc(db, 'users', user.uid);
    const setStatus = (isOnline: boolean) => {
        updateDoc(userStatusRef, { online: isOnline, lastSeen: serverTimestamp() }).catch(() => {});
    };
    setStatus(true);
    const handleVisibilityChange = () => setStatus(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (auth.currentUser) updateDoc(userStatusRef, { online: false, lastSeen: serverTimestamp() }).catch(() => {});
    };
  }, [user]);

  if (suspensionData?.active) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-background">
              <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:6rem_4rem] opacity-25"></div>
              
              <div className="max-w-md w-full space-y-6">
                <div className="h-24 w-24 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                    <ShieldAlert className="h-12 w-12 text-destructive" />
                </div>
                
                <div className="space-y-2">
                    <h1 className="text-4xl font-black font-headline tracking-tighter">Account Blocked</h1>
                    <p className="text-muted-foreground font-medium">Your access to the Makerere network has been restricted.</p>
                </div>

                <div className="bg-destructive/5 border border-destructive/20 p-6 rounded-3xl space-y-4">
                    <div className="text-left space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-destructive/60">Reason for Suspension</p>
                        <p className="text-sm font-bold italic">"{suspensionData.reason}"</p>
                    </div>
                    <Separator className="bg-destructive/10" />
                    <div className="flex items-center justify-between text-left">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Access Restored On</p>
                            <p className="text-sm font-black">{format(suspensionData.expires!, 'MMMM d, h:mm a')}</p>
                        </div>
                        <Clock className="h-5 w-5 text-muted-foreground" />
                    </div>
                </div>

                <div className="pt-4 flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">If you believe this is an error, please contact the campus administrators.</p>
                    <Button variant="ghost" onClick={() => signOut(auth).then(() => router.push('/login'))} className="font-bold">
                        Switch Account
                    </Button>
                </div>
              </div>
          </div>
      )
  }

  if (isMaintenance && pathname !== '/admin') {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
              <Construction className="h-16 w-16 text-primary mb-4 animate-bounce" />
              <h1 className="text-3xl font-black">Campus Maintenance</h1>
              <p className="text-muted-foreground mt-2 max-w-sm">We're upgrading the Makerere network experience. We'll be back shortly.</p>
          </div>
      )
  }

  return (
    <SidebarProvider>
      <Sidebar><SidebarHeader><SidebarLogo /></SidebarHeader><SidebarContent><AppSidebarNav /></SidebarContent></Sidebar>
      <SidebarInset className="flex flex-col h-svh overflow-hidden">
        <AppHeader />
        <main className="flex-1 flex flex-col min-h-0 bg-background overflow-y-auto pb-14 md:pb-0">
          {children}
        </main>
        <AppBottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
