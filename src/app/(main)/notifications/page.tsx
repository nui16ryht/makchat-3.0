"use client";

import React, { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, UserPlus, Bell, Loader2, UserCheck, AtSign } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export type NotificationType = 'like' | 'comment' | 'reply' | 'follow' | 'message' | 'mention' | 'repost' | 'quote';

export type Notification = {
    id: string;
    type: NotificationType;
    actor: {
        uid: string;
        name: string;
        username: string;
        avatar: string;
    };
    entity: {
        type: 'post' | 'comment' | 'user' | 'conversation';
        id: string;
        content?: string;
    };
    read: boolean;
    timestamp: any;
};

const NotificationIcon = ({ type }: { type: NotificationType }) => {
    switch (type) {
        case 'like': return <Heart className="h-5 w-5 text-red-500" />;
        case 'comment': return <MessageCircle className="h-5 w-5 text-blue-500" />;
        case 'reply': return <MessageCircle className="h-5 w-5 text-sky-500" />;
        case 'follow': return <UserPlus className="h-5 w-5 text-green-500" />;
        case 'message': return <MessageCircle className="h-5 w-5 text-purple-500" />;
        case 'mention': return <AtSign className="h-5 w-5 text-orange-500" />;
        case 'repost':
        case 'quote': return <Bell className="h-5 w-5 text-primary" />;
        default: return <Bell className="h-5 w-5" />;
    }
};

const FollowButton = ({ actor }: { actor: Notification['actor'] }) => {
    const [currentUser] = useAuthState(auth);
    const { toast } = useToast();
    const [isFollowing, setIsFollowing] = useState(false);
    const [isUpdating, setIsUpdating] = useState(true);

    useEffect(() => {
        if (!currentUser) {
            setIsUpdating(false);
            return;
        }
        const followingRef = doc(db, 'users', currentUser.uid, 'following', actor.uid);
        const unsub = onSnapshot(followingRef, (doc) => {
            setIsFollowing(doc.exists());
            setIsUpdating(false);
        });
        return () => unsub();
    }, [currentUser, actor.uid]);

    const handleFollow = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser) return;
        setIsUpdating(true);

        const currentUserFollowingRef = doc(db, 'users', currentUser.uid, 'following', actor.uid);
        const followedUserFollowersRef = doc(db, 'users', actor.uid, 'followers', currentUser.uid);

        try {
            const batch = writeBatch(db);
            if (isFollowing) {
                batch.delete(currentUserFollowingRef);
                batch.delete(followedUserFollowersRef);
                await batch.commit();
                toast({ title: `Unfollowed @${actor.username}` });
            } else {
                const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
                const currentUserData = currentUserDoc.data();

                if (!currentUserData) throw new Error("Current user data not found");
                
                batch.set(currentUserFollowingRef, {
                    username: actor.username, name: actor.name, avatar: actor.avatar, followedAt: serverTimestamp()
                });
                batch.set(followedUserFollowersRef, {
                    username: currentUserData.username, name: currentUserData.name, avatar: currentUserData.avatar, followedAt: serverTimestamp()
                });
                
                await batch.commit();
                toast({ title: `Followed back @${actor.username}` });
            }
        } catch (error) {
            console.error("Error following back:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not perform follow action.' });
        } finally {
            setIsUpdating(false);
        }
    };
    
    if (isUpdating) {
        return <Button size="sm" variant="secondary" disabled><Loader2 className="h-4 w-4 animate-spin" /></Button>;
    }
    
    if (isFollowing) {
        return <Button size="sm" variant="secondary" disabled><UserCheck className="mr-2 h-4 w-4"/>Following</Button>;
    }

    return (
        <Button size="sm" variant="outline" onClick={handleFollow}>
            <UserPlus className="mr-2 h-4 w-4" /> Follow Back
        </Button>
    )
}

const NotificationMessage = ({ notification }: { notification: Notification }) => {
    const { actor, type, entity } = notification;

    const actorLink = <Link href={`/profile/${actor.username}`} className="font-bold hover:underline" onClick={(e) => e.stopPropagation()}>{actor.name}</Link>;
    
    switch (type) {
        case 'like':
            return <p>{actorLink} liked <Link href={`/post/${entity.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>your post</Link>.</p>;
        case 'comment':
            return <p>{actorLink} commented on <Link href={`/post/${entity.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>your post</Link>: <span className="text-muted-foreground italic">"{entity.content}"</span></p>;
        case 'reply':
            return <p>{actorLink} replied to <Link href={`/post/${entity.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>your comment</Link>.</p>;
        case 'follow':
            return <div className="flex items-center justify-between w-full">
                <span>{actorLink} started following you.</span>
                <FollowButton actor={actor} />
            </div>;
        case 'message':
             return <p>{actorLink} sent you a new message: <span className="text-muted-foreground italic">"{entity.content}"</span></p>;
        case 'mention':
             return <p>{actorLink} mentioned you in a <Link href={`/post/${entity.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>post</Link>: <span className="text-muted-foreground italic">"{entity.content}"</span></p>;
        case 'repost':
             return <p>{actorLink} reposted <Link href={`/post/${entity.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>your post</Link>.</p>;
        case 'quote':
             return <p>{actorLink} quoted <Link href={`/post/${entity.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>your post</Link>.</p>;
        default:
            return <p>New notification from {actor.name}.</p>;
    }
};

export default function NotificationsPage() {
    const [user, loadingAuth] = useAuthState(auth);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!user) {
            if(!loadingAuth) setLoading(false);
            return;
        }

        const notificationsRef = collection(db, 'users', user.uid, 'notifications');
        const q = query(notificationsRef, orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedNotifications: Notification[] = [];
            snapshot.forEach(doc => {
                if (doc.data().type !== 'story_like' && doc.data().type !== 'story_comment') {
                    fetchedNotifications.push({ id: doc.id, ...doc.data() } as Notification);
                }
            });
            setNotifications(fetchedNotifications);
            setLoading(false);
            
            markAllAsRead(fetchedNotifications);
        });

        const markAllAsRead = async (notifs: Notification[]) => {
            const unreadNotifs = notifs.filter(n => !n.read);
            if (unreadNotifs.length === 0) return;
            
            const batch = writeBatch(db);
            unreadNotifs.forEach(notif => {
                const notifRef = doc(db, 'users', user.uid, 'notifications', notif.id);
                batch.update(notifRef, { read: true });
            });
            await batch.commit();
        };

        return () => unsubscribe();
    }, [user, loadingAuth]);

    const handleNotificationClick = (notification: Notification) => {
         switch (notification.type) {
            case 'like':
            case 'comment':
            case 'reply':
            case 'mention':
            case 'repost':
            case 'quote':
                router.push(`/post/${notification.entity.id}`);
                break;
            case 'follow':
                router.push(`/profile/${notification.actor.username}`);
                break;
            case 'message':
                router.push(`/messages?id=${notification.entity.id}`);
                break;
        }
    }
    
    if (loading || loadingAuth) {
        return (
            <div className="p-4 md:p-6 lg:p-8 pb-20 md:pb-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Notifications</CardTitle>
                        <CardDescription>Recent activity from your account.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/4" />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="p-4 md:p-6 lg:p-8 pb-20 md:pb-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Notifications</CardTitle>
                        <CardDescription>You need to be logged in to see your notifications.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild>
                            <Link href="/login">Log In</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 pb-20 md:pb-6">
            <Card>
                <CardHeader>
                    <CardTitle>Notifications</CardTitle>
                    <CardDescription>Recent activity from your account.</CardDescription>
                </CardHeader>
                <CardContent>
                    {notifications.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Bell className="mx-auto h-12 w-12 mb-4" />
                            <h3 className="font-semibold text-lg">No notifications yet</h3>
                            <p>When you get likes, comments, or new followers, they'll show up here.</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {notifications.map(notification => (
                                <div key={notification.id} 
                                    className={cn(
                                        "flex items-start gap-4 p-3 rounded-lg cursor-pointer hover:bg-secondary",
                                        !notification.read && "bg-secondary"
                                    )}
                                    onClick={() => handleNotificationClick(notification)}>
                                    <div className="relative">
                                        <Link href={`/profile/${notification.actor.username}`} onClick={(e) => e.stopPropagation()}>
                                            <Avatar className="h-10 w-10">
                                                <AvatarImage src={notification.actor.avatar} />
                                                <AvatarFallback>{notification.actor.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                        </Link>
                                        <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                                            <NotificationIcon type={notification.type} />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm"><NotificationMessage notification={notification} /></div>
                                        <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(notification.timestamp.toDate(), { addSuffix: true })}</p>
                                    </div>
                                    {!notification.read && <div className="h-2.5 w-2.5 rounded-full bg-primary mt-1 self-center" />}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
