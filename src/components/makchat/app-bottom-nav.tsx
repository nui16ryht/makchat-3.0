
"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageCircle, User, Bell, ShoppingCart, Landmark, Wrench } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';

const navItems = [
  { href: '/home', icon: Home, label: 'Home' },
  { href: '/messages', icon: MessageCircle, label: 'Messages', key: 'messages' },
  { href: '/curia', icon: Landmark, label: 'The Curia', key: 'curia' },
  { href: '/services', icon: Wrench, label: 'Services', key: 'services' },
  { href: '/mak-mart', icon: ShoppingCart, label: 'MakMart', key: 'mak-mart' },
  { href: '/notifications', icon: Bell, label: 'Notifications', key: 'notifications' },
  { href: '/profile/me', icon: User, label: 'Profile' },
];

export function AppBottomNav() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [user] = useAuthState(auth);
  const [isMounted, setIsMounted] = useState(false);
  
  const [unreadState, setUnreadState] = useState({
    messages: false,
    notifications: false,
    services: false,
    makMart: false,
    curia: false,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!user || !isMounted) return;
    
    const createUnreadListener = (
        collectionName: string,
        stateKey: keyof typeof unreadState,
        storageKey: string,
    ) => {
        try {
            const lastReadTimestamp = parseInt(typeof window !== 'undefined' ? localStorage.getItem(storageKey) || '0' : '0', 10);
            const q = query(collection(db, collectionName), orderBy('timestamp', 'desc'), limit(1));
            
            return onSnapshot(q, (snapshot) => {
                if (!snapshot.empty) {
                    const latestDoc = snapshot.docs[0].data();
                    if (latestDoc.timestamp && latestDoc.timestamp.toMillis() > lastReadTimestamp) {
                        setUnreadState(prev => ({...prev, [stateKey]: true}));
                    } else {
                        setUnreadState(prev => ({...prev, [stateKey]: false}));
                    }
                }
            }, () => {});
        } catch (e) {
            console.warn(`Listener failed for ${collectionName}:`, e);
            return () => {};
        }
    }

    const unsubs = [
        onSnapshot(query(collection(db, "conversations"), where("users", "array-contains", user.uid)), (snapshot) => {
            setUnreadState(prev => ({...prev, messages: snapshot.docs.some(doc => doc.data().unreadCount?.[user.uid] > 0)}));
        }, () => {}),
        onSnapshot(query(collection(db, "users", user.uid, "notifications"), where("read", "==", false)), (snapshot) => {
            setUnreadState(prev => ({...prev, notifications: !snapshot.empty}));
        }, () => {}),
        createUnreadListener('mak-mart-listings', 'makMart', 'lastReadMakMart'),
        createUnreadListener('curia', 'curia', 'lastReadCuria'),
    ];

    return () => unsubs.forEach(unsub => { if(typeof unsub === 'function') unsub(); });

  }, [user, isMounted]);

  const handleLinkClick = (key?: string) => {
    if (key && typeof window !== 'undefined') {
        const storageKey = `lastRead${key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, 'M')}`;
        const finalKey = key === 'mak-mart' ? 'lastReadMakMart' : storageKey;
        
        try {
            localStorage.setItem(finalKey, Date.now().toString());
        } catch (e) {
            console.warn("LocalStorage blocked:", e);
        }

        if (key === 'services' || key === 'mak-mart' || key === 'curia') {
            const stateKey = key === 'mak-mart' ? 'makMart' : (key as keyof typeof unreadState);
            setUnreadState(prev => ({...prev, [stateKey]: false}));
        }
    }
  };

  if (!isMobile || !isMounted) {
    return null;
  }

  const itemsToShow = navItems.filter(item => ['Home', 'Messages', 'The Curia', 'Services', 'MakMart'].includes(item.label));
  const profileItem = navItems.find(item => item.label === 'Profile');
  if (profileItem) itemsToShow.push(profileItem);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm md:hidden">
      <div className="grid h-14 grid-cols-6">
        {itemsToShow.map((item) => {
          const isActive = pathname.startsWith(item.href) && (item.href !== '/home' || pathname === '/home');
           let hasUnread = false;
            switch(item.key) {
                case 'messages': hasUnread = unreadState.messages; break;
                case 'notifications': hasUnread = unreadState.notifications; break;
                case 'services': hasUnread = unreadState.services; break;
                case 'mak-mart': hasUnread = unreadState.makMart; break;
                case 'curia': hasUnread = unreadState.curia; break;
            }
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => handleLinkClick(item.key)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="sr-only">{item.label}</span>
              {hasUnread && (
                <span className="absolute top-2.5 right-[calc(50%-1.25rem)] h-2 w-2 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
