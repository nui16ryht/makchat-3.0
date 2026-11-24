
"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from './use-toast';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaInstallContextType {
  triggerInstallPrompt: () => void;
  isInstallable: boolean;
  isAppInstalled: boolean;
}

const PwaInstallContext = createContext<PwaInstallContextType>({
  triggerInstallPrompt: () => {},
  isInstallable: false,
  isAppInstalled: false,
});

export const usePwaInstall = () => useContext(PwaInstallContext);

export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    const checkAppInstalled = () => {
      if (typeof window === 'undefined') return;
      
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      if (isStandalone) {
        setIsAppInstalled(true);
      }
    };

    checkAppInstalled();

    const beforeInstallPromptHandler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };
    
    const appInstalledHandler = () => {
        setIsAppInstalled(true);
        setIsInstallable(false);
    }

    window.addEventListener('beforeinstallprompt', beforeInstallPromptHandler);
    window.addEventListener('appinstalled', appInstalledHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstallPromptHandler);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  }, []);

  const triggerInstallPrompt = useCallback(async () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isAndroid = /Android/.test(navigator.userAgent);

    if (deferredPromptRef.current) {
        // Chromium / Android Logic
        const deferredPrompt = deferredPromptRef.current;
        deferredPrompt.prompt();
        
        toast({
            title: isAndroid ? 'Installing MakChat...' : 'Install Started',
            description: isAndroid 
                ? 'The app installation has started on your Android device. Follow the system prompts to finish.'
                : 'Follow the browser prompts to install the app to your device.',
        });

        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsAppInstalled(true);
          setIsInstallable(false);
          deferredPromptRef.current = null;
        }
    } else if (isIOS) {
        // iOS Step-by-Step Logic
        toast({ 
            title: 'Install MakChat for iOS', 
            description: (
              <div className="mt-2 space-y-3 text-left">
                <p className="text-sm">Get the full campus experience by adding MakChat to your home screen.</p>
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 space-y-2">
                  <p className="text-xs font-bold text-primary flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">!</span>
                    iPhone / iPad Instructions:
                  </p>
                  <ol className="text-xs space-y-1.5 list-decimal list-inside text-muted-foreground font-medium">
                    <li>Tap the <span className="text-foreground font-black">Share</span> icon (the square with an up arrow).</li>
                    <li>Scroll down the menu.</li>
                    <li>Tap <span className="text-foreground font-black">"Add to Home Screen"</span>.</li>
                    <li>Tap <span className="text-foreground font-black text-primary">"Add"</span> in the top right corner.</li>
                  </ol>
                </div>
              </div>
            ),
            duration: 12000,
        });
    } else {
        // Fallback for other browsers
        toast({ 
            title: 'Install App', 
            description: 'To install MakChat, please use your browser\'s menu and select "Add to Home Screen" or "Install App".',
        });
    }
  }, [toast]);

  return (
    <PwaInstallContext.Provider value={{ triggerInstallPrompt, isInstallable, isAppInstalled }}>
      {children}
    </PwaInstallContext.Provider>
  );
}
