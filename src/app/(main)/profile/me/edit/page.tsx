"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from '@/hooks/use-toast';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, storage } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Camera, Store } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

type UserProfile = {
  name: string;
  username: string;
  bio: string;
  college: string;
  relationshipStatus: string;
  hostelHall: string;
  avatar: string;
  shopName: string;
};

export default function EditProfilePage() {
  const [user, loadingAuth] = useAuthState(auth);
  const router = useRouter();
  const [formData, setFormData] = useState<UserProfile>({ 
    name: '', 
    username: '', 
    bio: '', 
    college: '', 
    hostelHall: '', 
    relationshipStatus: '', 
    avatar: '',
    shopName: ''
  });
  const [initialUsername, setInitialUsername] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const profileData = userDocSnap.data() as UserProfile;
          setFormData({
              name: profileData.name || '',
              username: profileData.username || '',
              bio: profileData.bio || '',
              college: profileData.college || '',
              hostelHall: profileData.hostelHall || '',
              relationshipStatus: profileData.relationshipStatus || '',
              avatar: profileData.avatar || '',
              shopName: profileData.shopName || '',
          });
          setInitialUsername(profileData.username || '');
        } else {
          toast({ variant: 'destructive', title: 'Profile not found' });
          router.push('/profile/me');
        }
      }
      setIsLoading(false);
    };
    if(!loadingAuth) fetchProfile();
  }, [user, loadingAuth, router, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    
    const toastId = toast({
      title: 'Saving Profile...',
      description: <div className="flex items-center gap-2"><Loader2 className="animate-spin h-4 w-4" /> Please wait.</div>,
    });

    const newUsername = formData.username.trim().toLowerCase();
    const sanitizedName = formData.name.trim();
    const sanitizedShopName = formData.shopName.trim();

    // Validate username format
    if (!/^[a-z0-9_.]+$/.test(newUsername)) {
      toastId.update({ id: toastId.id, variant: "destructive", title: "Invalid Username", description: "Username can only contain lowercase letters, numbers, underscores, and periods."});
      setIsSaving(false);
      return;
    }
    
    // Check if username is already taken
    if (newUsername !== initialUsername) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where("username", "==", newUsername));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            toastId.update({ id: toastId.id, variant: "destructive", title: "Username Taken", description: "This username is already in use. Please choose another one." });
            setIsSaving(false);
            return;
        }
    }

    const userDocRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userDocRef, {
        name: sanitizedName,
        username: newUsername,
        bio: formData.bio,
        college: formData.college.trim(),
        hostelHall: formData.hostelHall.trim(),
        relationshipStatus: formData.relationshipStatus,
        shopName: sanitizedShopName,
      });

      toastId.update({ id: toastId.id, title: "Profile Updated", description: "Your changes have been saved." });
      router.push(`/profile/${newUsername}`);

    } catch (error) {
      console.error("Error updating profile:", error);
      toastId.update({ id: toastId.id, title: "Error", description: "Could not update your profile.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (loadingAuth || isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-2xl mx-auto">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 grid gap-6 max-w-2xl mx-auto pb-24">
        <Card className="rounded-2xl border-none shadow-sm">
            <CardHeader>
                <CardTitle className="text-2xl font-black font-headline tracking-tight">Edit Profile</CardTitle>
                <CardDescription>Customize your public presence on campus.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSaveChanges} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Display Name</Label>
                        <Input id="name" value={formData.name} onChange={handleInputChange} className="rounded-xl h-12" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input id="username" value={formData.username} onChange={handleInputChange} className="rounded-xl h-12" />
                    </div>
                </div>

                <div className="bg-primary/5 p-4 rounded-2xl space-y-4 border border-primary/10">
                    <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
                        <Store className="h-4 w-4" /> MakMart Business
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="shopName">Shop Name</Label>
                        <Input id="shopName" value={formData.shopName} onChange={handleInputChange} placeholder="e.g. Wright's Electronics" className="rounded-xl h-12 bg-card" />
                        <p className="text-[10px] text-muted-foreground italic">Naming your shop helps students find your items faster in the MakMart Shops tab.</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea id="bio" value={formData.bio} onChange={handleInputChange} className="rounded-xl min-h-[100px]" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="college">College</Label>
                        <Input id="college" value={formData.college} onChange={handleInputChange} className="rounded-xl h-12" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="hostelHall">Hostel/Hall</Label>
                        <Input id="hostelHall" value={formData.hostelHall} onChange={handleInputChange} className="rounded-xl h-12" />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" type="button" onClick={() => router.back()} className="rounded-xl h-12 px-8 font-bold">Cancel</Button>
                    <Button type="submit" disabled={isSaving} className="rounded-xl h-12 px-8 font-bold">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Changes
                    </Button>
                </div>
                </form>
            </CardContent>
        </Card>
    </div>
  );
}
