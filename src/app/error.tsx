"use client";

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // If it is a ChunkLoadError, automatically reload once to fetch the latest assets
    if (error?.name === 'ChunkLoadError' || error?.message?.includes('Loading chunk') || error?.message?.includes('ChunkLoadError')) {
      const lastReload = sessionStorage.getItem('chunk_reload_ts');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload) > 10000) {
        sessionStorage.setItem('chunk_reload_ts', String(now));
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md border-border/50 shadow-lg rounded-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-bold font-headline">Something went wrong</CardTitle>
          <CardDescription>
            An asset or connection update occurred. Please refresh to load the latest version.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={() => window.location.reload()} className="w-full rounded-xl font-bold">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reload Page
          </Button>
          <Button variant="outline" onClick={() => reset()} className="w-full rounded-xl font-medium">
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
