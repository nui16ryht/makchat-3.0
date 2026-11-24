
"use client";
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Landmark, Clock, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, storage } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, Timestamp, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Skeleton } from '@/components/ui/skeleton';
import { GuestBanner } from '@/components/makchat/guest-banner';
import { CreatePost } from '@/components/makchat/create-post';
import { PostCard, type Post } from '@/components/makchat/post-card';

const ADJECTIVES = ["Swift", "Brave", "Quiet", "Bright", "Sharp", "Wild", "Lone", "Clever", "Calm", "Fierce"];
const NOUNS = ["Lion", "Owl", "Rhino", "Crane", "Eagle", "Leopard", "Cobra", "Elephant", "Falcon", "Gorilla"];

const generateNickname = (uid: string) => {
    if (!uid) return "Anonymous student";
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    const adjIdx = Math.abs(hash) % ADJECTIVES.length;
    const nounIdx = Math.abs(hash >> 2) % NOUNS.length;
    const number = Math.abs(hash >> 4) % 9999;
    return `${ADJECTIVES[adjIdx]} ${NOUNS[nounIdx]} #${number}`;
};

/**
 * Gets the current hour in Uganda by forcing UTC+3 calculation
 * This ignores the device's local timezone setting.
 */
const getUgandaTime = () => {
    const now = new Date();
    // Get UTC time in milliseconds, add 3 hours for EAT (Uganda)
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 3));
};

const getUgandaHour = () => {
    return getUgandaTime().getHours();
};

/**
 * Calculates the absolute session start time (20:00 EAT)
 */
const getSessionStartTime = () => {
    const ugandaNow = getUgandaTime();
    const startTime = new Date(ugandaNow);
    
    // If it's before 8 PM, the "current session" technically started yesterday 8 PM
    if (ugandaNow.getHours() < 20) {
        startTime.setDate(startTime.getDate() - 1);
    }
    
    startTime.setHours(20, 0, 0, 0);
    
    // Convert back to local time for Firestore query comparison
    const offsetFromUTC = 3 * 3600000;
    const utcStartTime = startTime.getTime() - offsetFromUTC;
    const localOffset = new Date().getTimezoneOffset() * 60000;
    
    return new Date(utcStartTime - localOffset);
};

export default function CuriaPage() {
    const { toast } = useToast();
    const [user, loadingAuth] = useAuthState(auth);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [hasPostedTonight, setHasPostedTonight] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [countdown, setCountdown] = useState<string | null>(null);
    const [manualOverride, setManualOverride] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const nickname = useMemo(() => user ? generateNickname(user.uid) : "Anonymous", [user]);

    useEffect(() => {
        const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (d) => {
            if (d.exists()) setManualOverride(!!d.data().manualCuriaOpen);
        }, () => {});
        return () => unsubSettings();
    }, []);

    const checkStatus = useCallback(() => {
        if (!isMounted) return;
        const ugandaNow = getUgandaTime();
        const ugandaHour = ugandaNow.getHours();
        const ugandaMinute = ugandaNow.getMinutes();
        
        // Open 8 PM (20) to 1 AM (1)
        const isCurrentlyOpen = manualOverride || (ugandaHour >= 20 || ugandaHour < 1);
        setIsOpen(isCurrentlyOpen);

        // Countdown for 5-minute warning (7:55 PM to 7:59 PM)
        if (!manualOverride && ugandaHour === 19 && ugandaMinute >= 55) {
            const minutesLeft = 59 - ugandaMinute;
            const secondsLeft = 60 - ugandaNow.getSeconds();
            setCountdown(`${minutesLeft}:${secondsLeft.toString().padStart(2, '0')}`);
        } else setCountdown(null);
    }, [manualOverride, isMounted]);

    useEffect(() => {
        const timer = setInterval(checkStatus, 1000);
        checkStatus();
        return () => clearInterval(timer);
    }, [checkStatus]);

    useEffect(() => {
        if (!user || !isOpen || !isMounted) {
            if (isMounted) setLoadingPosts(false);
            return;
        }
        
        const sessionStart = getSessionStartTime();
        const q = query(
            collection(db, "curia"), 
            where("timestamp", ">=", Timestamp.fromDate(sessionStart)), 
            orderBy("timestamp", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
            setPosts(msgs);
            setHasPostedTonight(!!msgs.find(m => m.user.uid === user.uid));
            setLoadingPosts(false);
        }, (error) => {
            console.error("Curia Fetch Error:", error);
            setLoadingPosts(false);
        });
        return () => unsubscribe();
    }, [user, isOpen, isMounted]);

    const handleCreatePost = async (content: string, mediaFile?: File | null, poll?: any) => {
        if (!user || hasPostedTonight || isSending) return;
        setIsSending(true);
        try {
            let mediaURL: string | undefined = undefined;
            let mediaType: 'image' | 'video' | undefined;
            if (mediaFile) {
                const mediaRef = ref(storage, `curia/${user.uid}/${Date.now()}_${mediaFile.name}`);
                const snap = await uploadBytes(mediaRef, mediaFile);
                mediaURL = await getDownloadURL(snap.ref);
                mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'image';
            }

            const postData: any = {
                user: { uid: user.uid, name: nickname, username: "anonymous", avatar: "" },
                content,
                poll: poll || null,
                timestamp: serverTimestamp(),
                stats: { likes: 0, comments: 0, reposts: 0 },
                likedBy: []
            };

            if (mediaURL) {
                postData.mediaURL = mediaURL;
                postData.mediaType = mediaType;
            }

            await addDoc(collection(db, "curia"), postData);
            toast({ title: "Post Live!" });
        } catch (error) { 
            console.error("Post Error:", error);
            toast({ variant: "destructive", title: "Failed to post" }); 
        }
        finally { setIsSending(false); }
    };

    if (!isMounted || loadingAuth) return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!user) return <div className="p-4"><GuestBanner /></div>;

    if (!isOpen) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse"><Clock className="h-10 w-10 text-primary" /></div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-bold font-headline">The Curia is Resting</h2>
                    <p className="text-muted-foreground max-w-sm mx-auto">Anonymous space awakens <span className="font-bold text-foreground">8:00 PM - 1:00 AM</span> EAT (Uganda Time). Data wipes at dawn.</p>
                </div>
                {countdown && <div className="bg-primary text-primary-foreground px-6 py-3 rounded-full font-bold text-xl animate-bounce">Opening in {countdown}</div>}
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full min-h-0 bg-muted/10 overflow-x-hidden">
            <div className="flex-shrink-0 flex items-center justify-between p-4 border-b bg-background shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-primary/20 p-2 rounded-full text-primary shrink-0"><Landmark size={24}/></div>
                    <div className="min-w-0">
                        <p className="font-bold text-xl font-headline leading-none truncate">The Curia</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter truncate mt-1">8pm - 1am • {nickname}</p>
                    </div>
                </div>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6 max-w-2xl mx-auto overflow-x-hidden">
                    {!hasPostedTonight && <div className="bg-card rounded-xl border shadow-sm overflow-hidden"><CreatePost onCreatePost={handleCreatePost} isCuria nickname={nickname} /></div>}
                    {loadingPosts ? (
                        <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
                    ) : (
                        <div className="space-y-4 w-full">
                            {posts.length === 0 ? (
                                <div className="text-center py-20 bg-background/50 rounded-2xl border-2 border-dashed">
                                    <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-10" />
                                    <p className="text-muted-foreground font-bold italic">The night is quiet. Speak your truth.</p>
                                </div>
                            ) : (
                                posts.map(post => (
                                    <PostCard 
                                        key={post.id} 
                                        post={post} 
                                        onUpdatePost={(p) => setPosts(prev => prev.map(it => it.id === p.id ? p : it))} 
                                        onDeletePost={(id) => setPosts(prev => prev.filter(p => p.id !== id))} 
                                    />
                                ))
                            )}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
