
"use client";

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { collection, doc, getDocs, onSnapshot, query, where, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';

export type UserReference = {
  id: string;
  username: string;
  name: string;
  avatar: string;
};

interface FollowListDialogProps {
  userId: string;
  type: 'followers' | 'following';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UserListItem = ({
  userToList,
  currentUser,
  currentUserFollowing,
  onFollowToggle,
  isUpdating,
  onClose,
}: {
  userToList: UserReference;
  currentUser: any;
  currentUserFollowing: string[];
  onFollowToggle: (userId: string, username: string, name: string, avatar: string, isFollowing: boolean) => void;
  isUpdating: boolean;
  onClose: () => void;
}) => {
  if (!userToList || !userToList.name) {
    return null; // Don't render if user data is incomplete
  }
    
  const isSelf = currentUser?.uid === userToList.id;
  const isFollowing = currentUserFollowing.includes(userToList.id);

  const handleFollowClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onFollowToggle(userToList.id, userToList.username, userToList.name, userToList.avatar, isFollowing);
  }

  return (
    <div className="flex items-center justify-between p-2 rounded-md hover:bg-secondary">
      <Link href={`/profile/${userToList.username}`} onClick={onClose} className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={userToList.avatar} alt={userToList.name} data-ai-hint="person face" />
          <AvatarFallback>{userToList.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-sm hover:underline">{userToList.name}</p>
          <p className="text-xs text-muted-foreground">@{userToList.username}</p>
        </div>
      </Link>
      {!isSelf && (
        <Button
            size="sm"
            variant={isFollowing ? "secondary" : "outline"}
            onClick={handleFollowClick}
            disabled={isUpdating}
        >
            {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
            ) : isFollowing ? (
            <UserCheck className="mr-2 h-4 w-4" />
            ) : (
            <UserPlus className="mr-2 h-4 w-4" />
            )}
            {isFollowing ? 'Following' : 'Follow'}
        </Button>
      )}
    </div>
  );
};


export function FollowListDialog({ userId, type, open, onOpenChange }: FollowListDialogProps) {
  const [currentUser] = useAuthState(auth);
  const [users, setUsers] = useState<UserReference[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const [currentUserFollowing, setCurrentUserFollowing] = useState<string[]>([]);
  const [updatingFollow, setUpdatingFollow] = useState<string | null>(null);

   // Listen to current user's following list to update buttons in real time
  useEffect(() => {
    if (!currentUser) return;
    const followingRef = collection(db, 'users', currentUser.uid, 'following');
    const unsubscribe = onSnapshot(followingRef, (snapshot) => {
      setCurrentUserFollowing(snapshot.docs.map(doc => doc.id));
    });
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!open || !userId) return;

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const listRef = collection(db, 'users', userId, type);
        const listSnapshot = await getDocs(listRef);
        
        const fetchedUsers = listSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as UserReference));
        
        setUsers(fetchedUsers);

      } catch (error) {
        console.error(`Error fetching ${type}:`, error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: `Could not fetch user list.`,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [open, userId, type, toast]);
  
  const handleFollowToggle = async (profileUserId: string, profileUsername: string, profileName: string, profileAvatar: string, isCurrentlyFollowing: boolean) => {
    if (!currentUser) return;
    setUpdatingFollow(profileUserId);
    
    const currentUserFollowingRef = doc(db, 'users', currentUser.uid, 'following', profileUserId);
    const profileUserFollowersRef = doc(db, 'users', profileUserId, 'followers', currentUser.uid);

    try {
        const batch = writeBatch(db);
        if (isCurrentlyFollowing) {
            batch.delete(currentUserFollowingRef);
            batch.delete(profileUserFollowersRef);
            await batch.commit();
            toast({ title: `Unfollowed @${profileUsername}` });
        } else {
            const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
            const currentUserData = currentUserDoc.data();
            
            if(!currentUserData) throw new Error("Current user data not found");

            batch.set(currentUserFollowingRef, { 
                username: profileUsername,
                name: profileName,
                avatar: profileAvatar,
                followedAt: serverTimestamp() 
            });
            batch.set(profileUserFollowersRef, { 
                username: currentUserData.username,
                name: currentUserData.name,
                avatar: currentUserData.avatar,
                followedAt: serverTimestamp() 
            });
            
            const notificationRef = doc(collection(db, 'users', profileUserId, 'notifications'));
            batch.set(notificationRef, {
                type: 'follow',
                actor: { uid: currentUser.uid, name: currentUserData.name, username: currentUserData.username, avatar: currentUserData.avatar },
                entity: { type: 'user', id: currentUser.uid },
                read: false,
                timestamp: serverTimestamp(),
            });

            await batch.commit();
            toast({ title: `Following @${profileUsername}` });
        }
    } catch(err) {
        console.error("Failed to toggle follow", err);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update follow status.' });
    } finally {
        setUpdatingFollow(null);
    }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="capitalize">{type}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-80 -mx-6">
            <div className="px-6 space-y-2">
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-2">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-3 w-16" />
                                </div>
                            </div>
                            <Skeleton className="h-8 w-20 rounded-md" />
                        </div>
                    ))
                ) : users.length > 0 ? (
                    users.map(u => (
                        <UserListItem 
                            key={u.id}
                            userToList={u}
                            currentUser={currentUser}
                            currentUserFollowing={currentUserFollowing}
                            onFollowToggle={handleFollowToggle}
                            isUpdating={updatingFollow === u.id}
                            onClose={() => onOpenChange(false)}
                        />
                    ))
                ) : (
                    <div className="text-center text-muted-foreground py-16">
                        <p>No users to show.</p>
                    </div>
                )}
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
