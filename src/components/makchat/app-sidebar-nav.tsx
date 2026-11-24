
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, MessageCircle, User, LogOut, Settings, Bell, UserPlus, ShoppingCart, Landmark, Wrench } from 'lucide-react';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useSidebar } from '../ui/sidebar';
import { useToast } from '@/hooks/use-toast';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, signOut, db } from '@/lib/firebase';
import { Skeleton } from '../ui/skeleton';
import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';

const navItems = [
  { href: '/home', icon: Home, label: 'Home' },
  { href: '/messages', icon: MessageCircle, label: 'Messages', key: 'messages' },
  { href: '/curia', icon: Landmark, label: 'The Curia', key: 'curia' },
  { href: '/services', icon: Wrench, label: 'Services', key: 'services' },
  { href: '/mak-mart', icon: ShoppingCart, label: 'MakMart', key: 'mak-mart' },
  { href: '/notifications', icon: Bell, label: 'Notifications', key: 'notifications' },
  { href: '/follow-suggestions', icon: UserPlus, label: 'Suggestions' },
  { href: '/profile/me', icon: User, label: 'Profile' },
];

function UserProfileButton({ open }: { open: boolean }) {
    const router = useRouter();
    const { toast } = useToast();
    const [user, loading] = useAuthState(auth);
    const { isMobile, setOpenMobile } = useSidebar();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => { setIsMounted(true); }, []);

    const handleLogout = async () => {
        await signOut(auth);
        toast({ title: "Logged Out" });
        router.push('/');
    }

    if (!isMounted || loading) {
        return <div className="flex items-center gap-3 p-2"><Skeleton className="h-9 w-9 rounded-full" />{open && <div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>}</div>
    }

    const displayName = user?.displayName ?? 'Guest User';
    const displayUsername = user?.isAnonymous ? 'guest' : user?.email?.split('@')[0] ?? 'anonymous';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-2 h-auto">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={user?.photoURL ?? `https://picsum.photos/seed/${user?.uid}/100`} />
                            <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {open && <div className="text-left truncate"><p className="font-semibold text-sm truncate">{displayName}</p><p className="text-xs text-muted-foreground truncate">@{displayUsername}</p></div>}
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild onClick={() => isMobile && setOpenMobile(false)}><Link href="/profile/me"><User className="mr-2 h-4 w-4" /><span>Profile</span></Link></DropdownMenuItem>
                <DropdownMenuItem asChild onClick={() => isMobile && setOpenMobile(false)}><Link href="/settings"><Settings className="mr-2 h-4 w-4" /><span>Settings</span></Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" /><span>Logout</span></DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export function AppSidebarNav() {
  const pathname = usePathname();
  const { open, isMobile, setOpenMobile } = useSidebar();
  const [user] = useAuthState(auth);
  const [unreadState, setUnreadState] = useState({ messages: false, notifications: false, services: false, makMart: false, curia: false });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!user || !isMounted) return;
    const unsubs = [
        onSnapshot(query(collection(db, "conversations"), where("users", "array-contains", user.uid)), (snapshot) => {
            setUnreadState(prev => ({...prev, messages: snapshot.docs.some(doc => doc.data().unreadCount?.[user.uid] > 0)}));
        }),
        onSnapshot(query(collection(db, "users", user.uid, "notifications"), where("read", "==", false)), (snapshot) => {
            setUnreadState(prev => ({...prev, notifications: !snapshot.empty}));
        }),
    ];
    return () => unsubs.forEach(unsub => unsub());
  }, [user, isMounted]);

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full">
        <SidebarMenu className="p-2 flex-1">
        {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href) && (item.href !== '/home' || pathname === '/home');
            let showBubble = false;
            if (item.key === 'messages') showBubble = unreadState.messages;
            if (item.key === 'notifications') showBubble = unreadState.notifications;
            return (
                <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={{ children: item.label, side: 'right' }}>
                  <Link href={item.href} onClick={() => isMobile && setOpenMobile(false)} className="relative">
                    <item.icon /><span>{item.label}</span>
                    {showBubble && open && <span className="absolute right-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />}
                  </Link>
                </SidebarMenuButton>
                </SidebarMenuItem>
            );
        })}
        </SidebarMenu>
        <Separator className="my-2" />
        <div className="p-2"><UserProfileButton open={open} /></div>
    </div>
  );
}
