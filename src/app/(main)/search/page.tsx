
"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PostCard, type Post } from '@/components/makchat/post-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { collection, query, getDocs, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, User, MessageSquare, Hash, BadgeCheck, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type UserSearchResult = {
  name: string;
  username: string;
  avatar: string;
  isVerified?: boolean;
  isGreen?: boolean;
}

function SearchPageComponent() {
  const searchParams = useSearchParams();
  const queryTerm = searchParams.get('q') || "";
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!queryTerm) {
      setLoading(false);
      setPosts([]);
      setUsers([]);
      return;
    };

    setLoading(true);

    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, limit(1000));
        const userSnapshot = await getDocs(q);
        
        const term = queryTerm.toLowerCase().trim();
        const fetchedUsers: UserSearchResult[] = [];
        
        userSnapshot.forEach(doc => {
          const data = doc.data();
          const name = (data.name || "").toLowerCase();
          const username = (data.username || "").toLowerCase();
          
          if (name.includes(term) || username.includes(term)) {
            fetchedUsers.push({ 
                name: data.name, 
                username: data.username, 
                avatar: data.avatar,
                isVerified: data.isVerified === true,
                isGreen: data.isGreen === true
            });
          }
        });
        
        fetchedUsers.sort((a, b) => {
            const aExact = a.username.toLowerCase() === term;
            const bExact = b.username.toLowerCase() === term;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            
            const aBadge = a.isVerified || a.isGreen;
            const bBadge = b.isVerified || b.isGreen;
            if (aBadge && !bBadge) return -1;
            if (!aBadge && bBadge) return 1;
            
            return a.name.localeCompare(b.name);
        });

        setUsers(fetchedUsers);
      } catch (e) {
          console.error("User search error:", e);
      }
    };

    const postQuery = query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(200));
    const unsubscribe = onSnapshot(postQuery, (querySnapshot) => {
        const allPosts: Post[] = [];
        querySnapshot.forEach((doc) => {
            allPosts.push({ id: doc.id, ...doc.data() } as Post);
        });
        
        const term = queryTerm.toLowerCase().trim();
        const filtered = allPosts.filter(post => {
          const content = (post.content || "").toLowerCase();
          const name = (post.user?.name || "").toLowerCase();
          const username = (post.user?.username || "").toLowerCase();
          
          const words = content.split(/\s+/);
          const isHashtagMatch = words.some(w => w.startsWith('#') && w.toLowerCase().includes(term));

          return (
            isHashtagMatch ||
            content.includes(term) ||
            name.includes(term) ||
            username.includes(term)
          );
        });
        
        setPosts(filtered);
        setLoading(false);
    });

    fetchUsers();

    return () => unsubscribe();

  }, [queryTerm]);

  const handleUpdatePost = (updatedPost: Post) => {
    setPosts(posts.map(p => p.id === updatedPost.id ? updatedPost : p));
  }
  const handleDeletePost = (postId: string) => {
    setPosts(posts.filter(p => p.id !== postId));
  }

  if (loading) {
     return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
            <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0">
                    <CardTitle className="text-3xl font-black font-headline">Searching for "{queryTerm}"...</CardTitle>
                </CardHeader>
            </Card>
            <div className="grid gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-[2rem]" />)}
            </div>
        </div>
     )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-4xl mx-auto pb-24">
        <header>
            <h1 className="text-4xl font-black font-headline tracking-tighter text-primary flex items-center gap-3">
                <Search className="h-8 w-8" /> Results: {queryTerm}
            </h1>
            <p className="text-muted-foreground font-medium mt-1">Found {users.length} students and {posts.length} stories.</p>
        </header>
      
        {users.length > 0 && (
            <section className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <User className="h-3 w-3" /> Students
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    {users.map(user => (
                        <Card key={user.username} className="rounded-2xl border-none shadow-sm hover:bg-muted/30 transition-all group overflow-hidden">
                           <CardContent className="p-4 flex items-center justify-between">
                                <Link href={`/profile/${user.username}`} className="flex items-center gap-4 flex-1 min-w-0">
                                    <Avatar className="h-12 w-12 border-2 border-primary/5">
                                        <AvatarImage src={user.avatar} />
                                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className="font-black text-sm truncate group-hover:text-primary transition-colors">{user.name}</p>
                                            {user.isVerified === true && <BadgeCheck className="h-4 w-4 fill-blue-500 text-white shrink-0" />}
                                            {user.isGreen === true && <BadgeCheck className="h-4 w-4 fill-green-500 text-white shrink-0" />}
                                        </div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">@{user.username}</p>
                                    </div>
                                </Link>
                                <Button asChild size="sm" variant="outline" className="rounded-full font-bold h-9 px-4 border-primary/20 text-xs">
                                    <Link href={`/profile/${user.username}`}>Profile</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>
        )}

        {posts.length > 0 && (
             <section className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <MessageSquare className="h-3 w-3" /> Campus Talk
                </h2>
                <div className="space-y-4">
                    {posts.map(post => (
                        <PostCard key={post.id} post={post} onUpdatePost={handleUpdatePost} onDeletePost={handleDeletePost} />
                    ))}
                </div>
            </section>
        )}

      {users.length === 0 && posts.length === 0 && (
        <Card className="rounded-[2rem] border-dashed border-2 border-primary/10 bg-primary/5">
            <CardContent className="p-20 text-center flex flex-col items-center">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Hash className="h-10 w-10 text-primary opacity-40" />
                </div>
                <h3 className="text-2xl font-black font-headline text-primary mb-2">No matches found</h3>
                <p className="text-muted-foreground font-medium max-w-xs">We couldn't find any students or posts matching your search. Try a broader term.</p>
                <Button asChild variant="outline" className="mt-8 rounded-full h-12 px-8 font-bold border-primary/20">
                    <Link href="/home">Return Home</Link>
                </Button>
            </CardContent>
        </Card>
      )}
    </div>
  );
}


export default function SearchPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></div>}>
            <SearchPageComponent />
        </Suspense>
    )
}
