
"use client";

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserPlus, LogIn } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';

export function GuestBanner() {
    const [user, loading] = useAuthState(auth);

    if (loading || user) {
        return null;
    }
    
    return (
        <div className="p-4 md:p-6 lg:p-8 pt-0 md:pt-0 lg:pt-0">
            <Card className="bg-primary/10 border-primary/20">
                <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-center sm:text-left">
                        <h3 className="font-bold text-lg text-primary-foreground/90">You're browsing as a guest</h3>
                        <p className="text-sm text-primary-foreground/70">Create an account to post, comment, and connect with your peers.</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <Button asChild variant="secondary">
                            <Link href="/login">
                                <LogIn className="mr-2 h-4 w-4" />
                                Login
                            </Link>
                        </Button>
                         <Button asChild>
                            <Link href="/signup">
                                <UserPlus className="mr-2 h-4 w-4" />
                                Sign Up
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
