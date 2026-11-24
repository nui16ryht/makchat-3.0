
"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { CreatePost } from "@/components/makchat/create-post";
import { PostCard } from "@/components/makchat/post-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc, writeBatch, getDocs, where, limit, startAfter, DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import type { Post } from '@/components/makchat/post-card';
import { SharePostDialog } from '@/components/makchat/share-post-dialog';
import { Conversation } from '../messages/page';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Loader2, Megaphone } from 'lucide-react';

function Feed({ 
    allPosts, 
    onUpdatePost, 
    onDeletePost, 
    onSharePost, 
    emptyMessage, 
    emptySubMessage,
    hasMore,
    onLoadMore,
    isLoadingMore
}: { 
    allPosts: Post[], 
    onUpdatePost: (post: Post) => void, 
    onDeletePost: (postId: string) => void, 
    onSharePost: (post: Post) => void, 
    emptyMessage: string, 
    emptySubMessage?: string,
    hasMore: boolean,
    onLoadMore: () => void,
    isLoadingMore: boolean
}) {
    const observerTarget = useRef(null);

    const uniquePosts = useMemo(() => {
        const seen = new Set();
        return allPosts.filter(post => {
            if (seen.has(post.id)) return false;
            seen.add(post.id);
            return true;
        });
    }, [allPosts]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
                    onLoadMore();
                }
            },
            { threshold: 1.0 }
        );
        if (observerTarget.current) observer.observe(observerTarget.current);
        return () => { if (observerTarget.current) observer.unobserve(observerTarget.current); };
    }, [hasMore, isLoadingMore, onLoadMore]);

    if (uniquePosts.length === 0 && !isLoadingMore) {
        return (
             <div className="text-center py-8 text-muted-foreground">
                <p>{emptyMessage}</p>
                {emptySubMessage && <p className="text-sm mt-1">{emptySubMessage}</p>}
             </div>
        )
    }

    return (
        <div className="space-y-4">
            {uniquePosts.map((post) => (
                <PostCard key={post.id} post={post} onUpdatePost={onUpdatePost} onDeletePost={onDeletePost} onSharePost={onSharePost} />
            ))}
            <div ref={observerTarget} className="h-10 w-full flex items-center justify-center">
                {isLoadingMore && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
            </div>
        </div>
    );
}

export default function HomePage() {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [lastDoc, setLastDoc] = React.useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const { toast } = useToast();
  const [sharingPost, setSharingPost] = React.useState<Post | null>(null);
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [currentUser] = useAuthState(auth);
  const [followingIds, setFollowingIds] = React.useState<string[]>([]);
  const [announcement, setAnnouncement] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(30));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const postsData: Post[] = [];
      querySnapshot.forEach((doc) => {
        postsData.push({ id: doc.id, ...doc.data() } as Post);
      });
      setPosts(prev => {
          const existingMap = new Map(prev.map(p => [p.id, p]));
          postsData.forEach(p => existingMap.set(p.id, p));
          return Array.from(existingMap.values()).sort((a,b) => {
              // Safe access to toMillis with fallback to Date.now() for pending writes
              const timeA = (a.timestamp && typeof a.timestamp.toMillis === 'function') ? a.timestamp.toMillis() : Date.now();
              const timeB = (b.timestamp && typeof b.timestamp.toMillis === 'function') ? b.timestamp.toMillis() : Date.now();
              return timeB - timeA;
          });
      });
      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
      setHasMore(querySnapshot.docs.length === 30);
    }, () => {});
    
    const unsubAnnounce = onSnapshot(doc(db, 'settings', 'global'), (d) => {
        if (d.exists()) setAnnouncement(d.data());
    }, () => {});

    return () => { unsubscribe(); unsubAnnounce(); };
  }, []);

  const loadMore = async () => {
    if (!lastDoc || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
        const nextQ = query(collection(db, "posts"), orderBy("timestamp", "desc"), startAfter(lastDoc), limit(20));
        const snapshot = await getDocs(nextQ);
        if (!snapshot.empty) {
            const nextPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
            setPosts(prev => {
                const existingIds = new Set(prev.map(p => p.id));
                return [...prev, ...nextPosts.filter(p => !existingIds.has(p.id))];
            });
            setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === 20);
        } else setHasMore(false);
    } catch (error) { console.error(error); }
    finally { setIsLoadingMore(false); }
  };

  useEffect(() => {
    if (!currentUser) { setFollowingIds([]); return; };
    const followingRef = collection(db, 'users', currentUser.uid, 'following');
    const unsubscribe = onSnapshot(followingRef, (snapshot) => {
        setFollowingIds(snapshot.docs.map(doc => doc.id));
    }, () => {});
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const convosQuery = query(collection(db, "conversations"), where("users", "array-contains", currentUser.uid));
    const unsubConvos = onSnapshot(convosQuery, (snapshot) => {
        setConversations(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Conversation)));
    }, () => {});
    return () => unsubConvos();
  }, [currentUser]);

  const handleCreatePost = async (content: string, mediaFile?: File | null) => {
    if (!currentUser) return;
    if (!content.trim() && !mediaFile) return;
    const toastId = toast({ title: 'Creating Post...', description: <div className="flex items-center gap-2"><Loader2 className="animate-spin h-4 w-4" /> Please wait.</div> });
    try {
        let mediaURL: string | undefined = undefined;
        let mediaType: 'image' | 'video' | undefined;
        if (mediaFile) {
            const mediaRef = ref(storage, `posts/${currentUser.uid}/${Date.now()}_${mediaFile.name}`);
            const snapshot = await uploadBytes(mediaRef, mediaFile);
            mediaURL = await getDownloadURL(snapshot.ref);
            mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'image';
        }
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) throw new Error("User profile not found.");
        const userProfile = userDocSnap.data();
        const postData: DocumentData = {
            user: { uid: currentUser.uid, name: userProfile.name, username: userProfile.username, avatar: userProfile.avatar },
            content, stats: { likes: 0, comments: 0, reposts: 0 }, likedBy: [], timestamp: serverTimestamp(),
        };
        if (mediaURL) { postData.mediaURL = mediaURL; postData.mediaType = mediaType; }
        const docRef = await addDoc(collection(db, "posts"), postData);
        toastId.update({ id: toastId.id, title: 'Post Created!' });
    } catch (error: any) { toastId.update({ id: toastId.id, variant: "destructive", title: "Error" }); }
  };
  
  const handleUpdatePost = useCallback((updatedPost: Post) => {
    setPosts(prevPosts => prevPosts.map(p => p.id === updatedPost.id ? updatedPost : p));
  }, []);

  const handleDeletePost = useCallback(async (postId: string) => {
    try {
      const batch = writeBatch(db);
      const postRef = doc(db, "posts", postId);
      batch.delete(postRef);
      await batch.commit();
      toast({ title: "Post Deleted" });
    } catch (error) { toast({ variant: "destructive", title: "Error" }); }
  }, [toast]);

  const handleSharePost = (post: Post) => setSharingPost(post);
  const handleShareToChat = async (targets: { type: 'dm'; id: string }[]) => {
      if (!sharingPost || !currentUser) return;
      try {
          const batch = writeBatch(db);
          for (const target of targets) {
              const messagesRef = doc(collection(db, "conversations", target.id, "messages"));
              batch.set(messagesRef, { text: `Check this post: ${window.location.origin}/post/${sharingPost.id}`, timestamp: serverTimestamp(), user: { uid: currentUser.uid } });
          }
          await batch.commit();
          toast({ title: 'Post Shared' });
      } catch (error) { toast({ variant: 'destructive', title: 'Error' }); }
  };

  const followingPosts = useMemo(() => posts.filter(post => followingIds.includes(post.user.uid)), [posts, followingIds]);
  const mostPopularPosts = useMemo(() => [...posts].sort((a, b) => ((b.stats?.likes || 0) + (b.stats?.comments || 0)) - ((a.stats?.likes || 0) + (a.stats?.comments || 0))), [posts]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 pb-20 md:pb-6">
      <SharePostDialog post={sharingPost} open={!!sharingPost} onOpenChange={(open) => !open && setSharingPost(null)} conversations={conversations} onShareToChat={handleShareToChat} />
      
      {announcement?.announcementActive && (
          <Card className="bg-primary/10 border-primary/20 shadow-none">
              <CardContent className="p-4 flex items-center gap-3">
                  <div className="bg-primary/20 p-2 rounded-full"><Megaphone className="h-4 w-4 text-primary" /></div>
                  <p className="text-sm font-bold leading-tight">{announcement.announcement}</p>
              </CardContent>
          </Card>
      )}

      <div className="space-y-6">
        <Card className="rounded-b-none shadow-none border-b-0">
          <CreatePost onCreatePost={handleCreatePost} />
        </Card>
        <Tabs defaultValue="for-you">
            <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="following">Following</TabsTrigger>
                <TabsTrigger value="for-you">For You</TabsTrigger>
                <TabsTrigger value="popular">Most Popular</TabsTrigger>
            </TabsList>
            <TabsContent value="following" className="mt-4">
                <Feed allPosts={followingPosts} onUpdatePost={handleUpdatePost} onDeletePost={handleDeletePost} onSharePost={handleSharePost} emptyMessage="Follow people to see their posts." hasMore={hasMore} onLoadMore={loadMore} isLoadingMore={isLoadingMore} />
            </TabsContent>
            <TabsContent value="for-you" className="mt-4">
                <Feed allPosts={posts} onUpdatePost={handleUpdatePost} onDeletePost={handleDeletePost} onSharePost={handleSharePost} emptyMessage="No posts to show right now." hasMore={hasMore} onLoadMore={loadMore} isLoadingMore={isLoadingMore} />
            </TabsContent>
            <TabsContent value="popular" className="mt-4">
                <Feed allPosts={mostPopularPosts} onUpdatePost={handleUpdatePost} onDeletePost={handleDeletePost} onSharePost={handleSharePost} emptyMessage="No popular posts right now." hasMore={hasMore} onLoadMore={loadMore} isLoadingMore={isLoadingMore} />
            </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
