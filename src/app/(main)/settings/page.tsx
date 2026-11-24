"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, signOut } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { Loader2, Edit, Smartphone } from 'lucide-react';
import { sendPasswordResetEmail, deleteUser } from 'firebase/auth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePwaInstall } from '@/hooks/use-pwa-install';

export default function SettingsPage() {
  const [user, loadingAuth] = useAuthState(auth);
  const router = useRouter();
  const [isActionLoading, setIsActionLoading] = useState<null | 'password' | 'delete'>(null);
  const { toast } = useToast();
  const { triggerInstallPrompt, isAppInstalled } = usePwaInstall();
  
  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setIsActionLoading('password');
    try {
        await sendPasswordResetEmail(auth, user.email);
        toast({
            title: "Password Reset Email Sent",
            description: `An email has been sent to ${user.email} with instructions to reset your password.`
        });
    } catch (error) {
        console.error("Error sending password reset email:", error);
        toast({
            title: "Error",
            description: "Could not send password reset email. Please try again later.",
            variant: "destructive"
        });
    } finally {
        setIsActionLoading(null);
    }
  }

  const handleLogout = async () => {
    await signOut(auth);
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
    router.push('/');
  }

  const handleDeleteAccount = async () => {
     if (!user) return;
     setIsActionLoading('delete');
     try {
        const userDocRef = doc(db, 'users', user.uid);
        await deleteDoc(userDocRef);
        
        await deleteUser(user);

        toast({
            title: "Account Deleted",
            description: "Your account has been permanently deleted."
        });
        router.push('/');
     } catch (error: any) {
        console.error("Error deleting account:", error);
        if (error.code === 'auth/requires-recent-login') {
             toast({
                title: "Login Required",
                description: "This is a sensitive security action. Please log out and log back in again to delete your account.",
                variant: "destructive",
                duration: 8000,
            });
        } else {
             toast({
                title: "Error Deleting Account",
                description: "An unexpected error occurred. Please try again.",
                variant: "destructive"
            });
        }
     } finally {
        setIsActionLoading(null);
     }
  }

  if (loadingAuth) {
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-2xl mx-auto pb-20 md:pb-6">
            <Card>
                <CardHeader>
                    <div className="h-6 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                    {[1,2,3,4].map(i => <div key={i} className="h-20 w-full bg-muted animate-pulse rounded-lg" />)}
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-2xl mx-auto pb-20 md:pb-10">
        <Card>
            <CardHeader>
                <CardTitle>Account Settings</CardTitle>
                <CardDescription>Manage your account settings and actions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 {!isAppInstalled && (
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-primary/5 border-primary/20">
                        <div>
                            <Label className="font-semibold">App Installation</Label>
                            <p className="text-sm text-muted-foreground">Install MakChat to your home screen for the best campus experience.</p>
                        </div>
                        <Button 
                            variant="default" 
                            onClick={triggerInstallPrompt} 
                            className="shrink-0"
                        >
                            <Smartphone className="mr-2 h-4 w-4"/> Install App
                        </Button>
                    </div>
                 )}

                 <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                        <Label className="font-semibold">Edit Profile</Label>
                        <p className="text-sm text-muted-foreground">Update your public profile information.</p>
                    </div>
                    <Button asChild variant="outline">
                      <Link href="/profile/me/edit">
                        <Edit className="mr-2 h-4 w-4"/> Edit
                      </Link>
                    </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                        <Label className="font-semibold">Change Password</Label>
                        <p className="text-sm text-muted-foreground">Receive an email to reset your password.</p>
                    </div>
                    <Button variant="outline" onClick={handlePasswordReset} disabled={isActionLoading === 'password'}>
                         {isActionLoading === 'password' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send Email
                    </Button>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                        <Label className="font-semibold">Logout</Label>
                        <p className="text-sm text-muted-foreground">Sign out of your account on this device.</p>
                    </div>
                    <Button variant="outline" onClick={handleLogout}>Logout</Button>
                </div>
                <div className="flex items-center justify-between p-4 border border-destructive/50 rounded-lg">
                    <div>
                        <Label className="font-semibold text-destructive">Delete Account</Label>
                        <p className="text-sm text-muted-foreground">Permanently delete your account and all data.</p>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isActionLoading === 'delete'}>
                                {isActionLoading === 'delete' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Delete
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete your
                                account and remove your data from our servers.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteAccount}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}