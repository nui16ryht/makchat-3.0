
"use client";

import { useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, messaging } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { onMessage, getToken, isSupported } from 'firebase/messaging';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { MessageSquare, Bell, Landmark, ShoppingBag, Briefcase, Info } from 'lucide-react';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [user] = useAuthState(auth);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;
    
    const requestPermissionAndToken = async () => {
      try {
        const supported = await isSupported();
        if (!supported || !messaging || !('serviceWorker' in navigator)) {
          return;
        }

        // Check if Notification API exists before using it (Fixes potential iOS crash)
        if (!('Notification' in window)) {
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Register the consolidated service worker
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          
          const currentToken = await getToken(messaging, {
            vapidKey: 'BO9C__eL6bslvflAnlp7DIaAmwGwjHtGPC7Fjg-ucFmVaS1fC7rQJvopkiV_MkoWknr27Y0j4xH4_3ZRK6GbGoU',
            serviceWorkerRegistration: registration
          });

          if (currentToken) {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists() && userDoc.data().fcmToken !== currentToken) {
              await updateDoc(userDocRef, { fcmToken: currentToken });
            }
          }
        }
      } catch (error) {
        console.error('Notification configuration error:', error);
      }
    };

    // Safe permission check for iOS
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        if (!sessionStorage.getItem('notif_prompt_dismissed')) {
            const { dismiss } = toast({
              title: 'Stay Notified',
              description: "Enable notifications for messages and campus activity.",
              duration: 10000,
              action: (
                <Button size="sm" onClick={async () => { dismiss(); await requestPermissionAndToken(); }}>Enable</Button>
              ),
            });
            sessionStorage.setItem('notif_prompt_dismissed', 'true');
        }
      } else if (Notification.permission === 'granted') {
        requestPermissionAndToken();
      }
    }

    // Only set up onMessage if supported
    let unsubscribe = () => {};
    isSupported().then(supported => {
      if (supported && messaging) {
        try {
          unsubscribe = onMessage(messaging, (payload) => {
            const type = payload.data?.type || 'default';
            let Icon = Bell;
            let accentClass = "text-primary";

            switch(type) {
              case 'message': Icon = MessageSquare; accentClass = "text-blue-500"; break;
              case 'curia': Icon = Landmark; accentClass = "text-accent"; break;
              case 'listing': Icon = ShoppingBag; accentClass = "text-green-500"; break;
              case 'gig': Icon = Briefcase; accentClass = "text-orange-500"; break;
              case 'broadcast': Icon = Info; accentClass = "text-primary"; break;
            }

            toast({
                title: (
                  <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${accentClass}`} />
                      <span className="font-black">{payload.notification?.title || 'MakChat Update'}</span>
                  </div>
                ) as any,
                description: payload.notification?.body || 'Check your notifications for details.',
                action: payload.data?.click_action ? (
                    <Button size="sm" className="rounded-full h-8" onClick={() => router.push(payload.data!.click_action!)}>View</Button>
                ) : undefined
            });
          });
        } catch (e) {
          console.warn("onMessage setup failed:", e);
        }
      }
    });

    return () => unsubscribe();
    
  }, [user, toast, router]);

  return <>{children}</>;
}
