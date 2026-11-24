"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Smartphone } from 'lucide-react';
import { usePwaInstall } from '@/hooks/use-pwa-install';

export function PwaInstallButton() {
  const { isAppInstalled, triggerInstallPrompt } = usePwaInstall();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || isAppInstalled) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-primary"
      onClick={triggerInstallPrompt}
      title="Install App"
    >
      <Smartphone className="h-5 w-5" />
      <span className="sr-only">Install App</span>
    </Button>
  );
}