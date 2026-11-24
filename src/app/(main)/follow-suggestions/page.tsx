
"use client";

import React, { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { collection, doc, writeBatch, serverTimestamp, getDoc, getDocs, query, limit, where } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { GuestBanner } from '@/components/makchat/guest-banner';
import { Separator } from '@/components/ui/separator';

type FollowSuggestion = {
    uid: string;
    username: string;
    name: string;
    avatar: string;
    reason: string;
};

type SuggestionResult = {
    networkSuggestions: FollowSuggestion[];
    otherSuggestions: FollowSuggestion[];
}

async function getFollowSuggestions(userId: string): Promise<SuggestionResult> {
    const followingRef = collection(db, 'users', userId, 'following');
    const followingSnapshot = await getDocs(followingRef);
    const followingIds = followingSnapshot.docs.map(doc => doc.id);
    const allMyConnections = new Set([userId, ...followingIds]);

    let networkSuggestions: FollowSuggestion[] = [];

    if (followingIds.length > 0) {
        const suggestionScores: Map<string, number> = new Map();
        
        const chunks = [];
        for (let i = 0; i < followingIds.length; i += 10) {
            chunks.push(followingIds.slice(i, i + 10));
        }

        for (const chunk of chunks) {
            await Promise.all(chunk.map(async (followedId) => {
                const friendsFollowingRef = collection(db, 'users', followedId, 'following');
                const friendsFollowingSnapshot = await getDocs(friendsFollowingRef);
                friendsFollowingSnapshot.forEach(doc => {
                    const suggestionId = doc.id;
                    if (!allMyConnections.has(suggestionId)) {
                        suggestionScores.set(suggestionId, (suggestionScores.get(suggestionId) || 0) + 1);
                    }
                });
            }));
        }

        const sortedSuggestionIds = Array.from(suggestionScores.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(entry => entry[0]);

        if (sortedSuggestionIds.length > 0) {
            const suggestionsQuery = query(collection(db, 'users'), where('__name__', 'in', sortedSuggestionIds));
            const suggestionsSnapshot = await getDocs(suggestionsQuery);

            networkSuggestions = suggestionsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    uid: doc.id,
                    username: data.username,
                    name: data.name,
                    avatar: data.avatar,
                    reason: `${suggestionScores.get(doc.id)} mutual follows`
                }
            });
            
            networkSuggestions.forEach(s => allMyConnections.add(s.uid));
        }
    }
    
    // Fetch 'other' users, excluding already connected or suggested users
    const otherUsersQuery = query(collection(db, 'users'), where('uid', 'not-in', Array.from(allMyConnections).slice(0,10)), limit(15));
    const otherUsersSnap = await getDocs(otherUsersQuery);
    const otherSuggestions = otherUsersSnap.docs
      .filter(doc => !allMyConnections.has(doc.id)) // Final check
      .map(doc => {
        const data = doc.data();
        return {
            uid: doc.id,
            username: data.username,
            name: data.name,
            avatar: data.avatar,
            reason: 'Popular user'
        }
    });

    return { networkSuggestions, otherSuggestions };
}


const FollowSuggestionItem = ({
    suggestion,
    onFollow,
    isFollowing,
    isUpdating
}: {
    suggestion: FollowSuggestion;
    onFollow: (suggestion: FollowSuggestion, follow: boolean) => void;
    isFollowing: boolean;
    isUpdating: boolean;
}) => {
    return (
        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary">
            <Link href={`/profile/${suggestion.username}`} className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                    <AvatarImage src={suggestion.avatar} alt={suggestion.name} data-ai-hint="person face" />
                    <AvatarFallback>{suggestion.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{suggestion.name}</p>
                    <p className="text-sm text-muted-foreground">@{suggestion.username}</p>
                    <p className="text-xs text-muted-foreground mt-1">{suggestion.reason}</p>
                </div>
            </Link>
            <Button
                size="sm"
                variant={isFollowing ? 'secondary' : 'outline'}
                onClick={() => onFollow(suggestion, !isFollowing)}
                disabled={isUpdating}
            >
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" />
                  : isFollowing ? <UserCheck className="mr-2 h-4 w-4" />
                  : <UserPlus className="mr-2 h-4 w-4" />}
                {isFollowing ? 'Following' : 'Follow'}
            </Button>
        </div>
    );
};

export default function FollowSuggestionsPage() {
    const [currentUser, loadingAuth] = useAuthState(auth);
    const { toast } = useToast();
    const [networkSuggestions, setNetworkSuggestions] = useState<FollowSuggestion[]>([]);
    const [otherSuggestions, setOtherSuggestions] = useState<FollowSuggestion[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(true);
    const [following, setFollowing] = useState<Set<string>>(new Set());
    const [updatingFollow, setUpdatingFollow] = useState<string | null>(null);

    useEffect(() => {
        if (!currentUser || loadingAuth) {
            setLoadingSuggestions(false);
            return;
        }

        const fetchSuggestions = async () => {
            setLoadingSuggestions(true);
            try {
                const { networkSuggestions: net, otherSuggestions: other } = await getFollowSuggestions(currentUser.uid);
                setNetworkSuggestions(net);
                setOtherSuggestions(other);
            } catch (error) {
                console.error("Error fetching suggestions:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load suggestions.' });
            } finally {
                setLoadingSuggestions(false);
            }
        };

        const fetchFollowing = async () => {
            const followingRef = collection(db, 'users', currentUser.uid, 'following');
            const snapshot = await getDocs(followingRef);
            setFollowing(new Set(snapshot.docs.map(doc => doc.id)));
        };

        fetchSuggestions();
        fetchFollowing();

    }, [currentUser, loadingAuth, toast]);
    
    const handleFollowToggle = async (suggestion: FollowSuggestion, follow: boolean) => {
        if (!currentUser) return;
        setUpdatingFollow(suggestion.uid);
        
        const currentUserFollowingRef = doc(db, 'users', currentUser.uid, 'following', suggestion.uid);
        const suggestionFollowersRef = doc(db, 'users', suggestion.uid, 'followers', currentUser.uid);

        try {
            const batch = writeBatch(db);
            if (follow) {
                const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
                const currentUserData = currentUserDoc.data();
                if (!currentUserData) throw new Error("Current user not found");

                batch.set(currentUserFollowingRef, {
                    username: suggestion.username,
                    name: suggestion.name,
                    avatar: suggestion.avatar,
                    followedAt: serverTimestamp()
                });
                batch.set(suggestionFollowersRef, {
                    username: currentUserData.username,
                    name: currentUserData.name,
                    avatar: currentUserData.avatar,
                    followedAt: serverTimestamp()
                });
                
                const notificationRef = doc(collection(db, 'users', suggestion.uid, 'notifications'));
                batch.set(notificationRef, {
                    type: 'follow', actor: { uid: currentUser.uid, name: currentUserData.name, username: currentUserData.username, avatar: currentUserData.avatar },
                    entity: { type: 'user', id: currentUser.uid }, read: false, timestamp: serverTimestamp(),
                });

                await batch.commit();
                setFollowing(prev => new Set(prev).add(suggestion.uid));
                toast({ title: `Following @${suggestion.username}` });

            } else {
                batch.delete(currentUserFollowingRef);
                batch.delete(suggestionFollowersRef);
                await batch.commit();
                setFollowing(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(suggestion.uid);
                    return newSet;
                });
                toast({ title: `Unfollowed @${suggestion.username}` });
            }
        } catch (error) {
            console.error("Error toggling follow:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update follow status.' });
        } finally {
            setUpdatingFollow(null);
        }
    };


    if (loadingAuth || loadingSuggestions) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Follow Suggestions</CardTitle>
                    <CardDescription>Suggestions for you to connect with.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </CardContent>
            </Card>
        );
    }
    
    if (!currentUser) {
        return <GuestBanner />;
    }

    const hasSuggestions = networkSuggestions.length > 0 || otherSuggestions.length > 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Follow Suggestions</CardTitle>
                <CardDescription>Suggestions based on your network and popular users.</CardDescription>
            </CardHeader>
            <CardContent>
                {!hasSuggestions ? (
                    <p className="text-muted-foreground text-center py-8">No suggestions right now. Check back later!</p>
                ) : (
                    <div className="space-y-6">
                        {networkSuggestions.length > 0 && (
                            <div className="space-y-2">
                                {networkSuggestions.map(s => (
                                    <FollowSuggestionItem
                                        key={s.uid}
                                        suggestion={s}
                                        onFollow={handleFollowToggle}
                                        isFollowing={following.has(s.uid)}
                                        isUpdating={updatingFollow === s.uid}
                                    />
                                ))}
                            </div>
                        )}
                        
                        {networkSuggestions.length > 0 && otherSuggestions.length > 0 && (
                            <div className="relative">
                                <Separator />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="bg-background px-2 text-sm text-muted-foreground">Others</span>
                                </div>
                            </div>
                        )}

                        {otherSuggestions.length > 0 && (
                             <div className="space-y-2">
                                {otherSuggestions.map(s => (
                                    <FollowSuggestionItem
                                        key={s.uid}
                                        suggestion={s}
                                        onFollow={handleFollowToggle}
                                        isFollowing={following.has(s.uid)}
                                        isUpdating={updatingFollow === s.uid}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
