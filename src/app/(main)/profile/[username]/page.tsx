
"use client";

import React, { useEffect, useState, Fragment } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard, type Post } from "@/components/makchat/post-card";
import { Calendar, GraduationCap, Heart, UserPlus, UserCheck, MessageCircle, Loader2, CalendarDays, Home, Repeat, ShieldCheck, ShieldAlert, BadgeCheck } from "lucide-react";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp, getDoc, orderBy, Timestamp, updateDoc, deleteDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { type Comment } from '@/components/makchat/comment-card';
import { ReplyCard } from '@/components/makchat/reply-card';
import { FollowListDialog } from '@/components/makchat/follow-list-dialog';
import Link from 'next/link';
import NextImage from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type UserProfile = {
  uid: string;
  name: string;
  username: string;
  avatar: string;
  coverImage: string;
  bio: string;
  college: string;
  relationshipStatus: string;
  joined: string;
  hostelHall: string;
  lastSeen: Timestamp;
  online: boolean;
  isVerified?: boolean;
  isGreen?: boolean;
};

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const params = useParams();
  const username = params.username as string;
  
  const [currentUser, loadingAuth] = useAuthState(auth);
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [reposts, setReposts] = useState<Post[]>([]);
  
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isUpdatingFollow, setIsUpdatingFollow] = useState(true);
  const [isMessaging, setIsMessaging] = useState(false);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followDialog, setFollowDialog] = useState<{ open: boolean, type: 'followers' | 'following' }>({ open: false, type: 'followers' });

  useEffect(() => {
    if (!username) return;

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where("username", "==", username));

    const unsub = onSnapshot(q, async (querySnapshot) => {
        setLoadingProfile(true);
        if (querySnapshot.empty) {
            setProfileUser(null);
            setLoadingProfile(false);
            return;
        }

        const userDoc = querySnapshot.docs[0];
        const userData = { uid: userDoc.id, ...userDoc.data() } as UserProfile;
        setProfileUser(userData);

        // Fetch user content
        const postsQuery = query(collection(db, 'posts'), where('user.uid', '==', userData.uid));
        onSnapshot(postsQuery, (snap) => {
          const fetchedPosts = snap.docs.map(d => ({id: d.id, ...d.data()} as Post));
          fetchedPosts.sort((a,b) => {
              const timeA = a.timestamp?.toMillis?.() ?? 0;
              const timeB = b.timestamp?.toMillis?.() ?? 0;
              return timeB - timeA;
          });
          setPosts(fetchedPosts);
        }, () => {});

        const repliesQuery = query(collection(db, 'comments'), where('user.uid', '==', userData.uid));
        onSnapshot(repliesQuery, (snap) => {
            let fetchedReplies = snap.docs.map(d => ({id: d.id, ...d.data()} as Comment));
            fetchedReplies = fetchedReplies.sort((a, b) => {
              const timeA = a.timestamp?.toMillis?.() ?? 0;
              const timeB = b.timestamp?.toMillis?.() ?? 0;
              return timeB - timeA;
            });
            setReplies(fetchedReplies);
        }, () => {});
        
        const repostsRef = collection(db, 'users', userData.uid, 'reposts');
        onSnapshot(repostsRef, async (repostSnap) => {
            const repostIds = repostSnap.docs.map(d => d.id);
            if (repostIds.length > 0) {
                const repostsQuery = query(collection(db, 'posts'), where('__name__', 'in', repostIds.slice(0, 30)));
                const repostsDataSnap = await getDocs(repostsQuery);
                setReposts(repostsDataSnap.docs.map(d => ({id: d.id, ...d.data()} as Post)));
            } else {
                setReposts([]);
            }
        }, () => {});
        
        const likedPostsRef = collection(db, 'users', userData.uid, 'likedPosts');
        onSnapshot(likedPostsRef, async (likeSnap) => {
            const likedPostIds = likeSnap.docs.map(d => d.id);
            if (likedPostIds.length > 0) {
                const likedPostsQuery = query(collection(db, 'posts'), where('__name__', 'in', likedPostIds.slice(0, 30)));
                const likedPostsDataSnap = await getDocs(likedPostsQuery);
                setLikedPosts(likedPostsDataSnap.docs.map(d => ({id: d.id, ...d.data()} as Post)));
            } else {
                setLikedPosts([]);
            }
        }, () => {});

        setLoadingProfile(false);
    }, () => setLoadingProfile(false));

    return () => unsub();
}, [username]);

  
  // Listen to follower/following status and counts
  useEffect(() => {
    if (!profileUser) return;
    
    const followersRef = collection(db, 'users', profileUser.uid, 'followers');
    const followingRef = collection(db, 'users', profileUser.uid, 'following');

    const unsubFollowers = onSnapshot(followersRef, (snapshot) => setFollowersCount(snapshot.size), () => {});
    const unsubFollowing = onSnapshot(followingRef, (snapshot) => setFollowingCount(snapshot.size), () => {});

    if (currentUser) {
      setIsUpdatingFollow(true);
      const currentUserFollowingRef = doc(db, 'users', currentUser.uid, 'following', profileUser.uid);
      const unsubIsFollowing = onSnapshot(currentUserFollowingRef, (doc) => {
        setIsFollowing(doc.exists());
        setIsUpdatingFollow(false);
      }, () => setIsUpdatingFollow(false));
      return () => {
        unsubIsFollowing();
        unsubFollowers();
        unsubFollowing();
      };
    } else {
        setIsUpdatingFollow(false);
    }
    
    return () => {
        unsubFollowers();
        unsubFollowing();
    };
  }, [currentUser, profileUser]);
  
  const handleFollowToggle = async () => {
    if (!currentUser || !profileUser || isUpdatingFollow) return;
    setIsUpdatingFollow(true);
    
    const currentUserFollowingRef = doc(db, 'users', currentUser.uid, 'following', profileUser.uid);
    const profileUserFollowersRef = doc(db, 'users', profileUser.uid, 'followers', currentUser.uid);
    const notificationRef = doc(collection(db, 'users', profileUser.uid, 'notifications'));

    try {
      const batch = writeBatch(db);
      if (isFollowing) {
        batch.delete(currentUserFollowingRef);
        batch.delete(profileUserFollowersRef);
      } else {
        const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const currentUserData = currentUserDoc.data();

        if (!currentUserData) {
            toast({ variant: 'destructive', title: 'Error' });
            setIsUpdatingFollow(false);
            return;
        }

        batch.set(currentUserFollowingRef, {
            username: profileUser.username, name: profileUser.name, avatar: profileUser.avatar, followedAt: serverTimestamp()
        });
         batch.set(profileUserFollowersRef, {
            username: currentUserData.username, name: currentUserData.name, avatar: currentUserData.avatar, followedAt: serverTimestamp()
        });

        batch.set(notificationRef, {
            type: 'follow', actor: { uid: currentUser.uid, name: currentUserData.name, username: currentUserData.username, avatar: currentUserData.avatar, },
            entity: { type: 'user', id: currentUser.uid }, read: false, timestamp: serverTimestamp(),
        });
      }
      await batch.commit();
      toast({ title: isFollowing ? `Unfollowed @${profileUser.username}` : `Following @${profileUser.username}` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error' });
    } finally {
      setIsUpdatingFollow(false);
    }
  };

  const handleStartConversation = async () => {
    if (!currentUser || !profileUser || currentUser.uid === profileUser.uid) return;
    
    setIsMessaging(true);
    const conversationId = [currentUser.uid, profileUser.uid].sort().join('_');
    const conversationRef = doc(db, 'conversations', conversationId);
    
    try {
      const docSnap = await getDoc(conversationRef);
      if (!docSnap.exists()) {
        const currentUserProfileSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (!currentUserProfileSnap.exists()) throw new Error("Profile not found");
        const currentUserData = currentUserProfileSnap.data();
        
        await setDoc(conversationRef, {
          users: [currentUser.uid, profileUser.uid],
          userNames: { [currentUser.uid]: currentUserData.name || currentUser.displayName, [profileUser.uid]: profileUser.name, },
          userAvatars: { [currentUser.uid]: currentUserData.avatar || currentUser.photoURL, [profileUser.uid]: profileUser.avatar, },
          userUsernames: { [currentUser.uid]: currentUserData.username, [profileUser.uid]: profileUser.username, },
          lastMessage: "",
          lastMessageTimestamp: serverTimestamp(),
          unreadCount: { [currentUser.uid]: 0, [profileUser.uid]: 0 },
        });
      }
      router.push(`/messages?id=${conversationId}`);
    } catch (error) {
      toast({ variant: "destructive", title: "Error Starting Chat" });
    } finally {
      setIsMessaging(false);
    }
  };

  const handleUpdatePost = (updatedPost: Post) => {
    setPosts(posts.map(p => p.id === updatedPost.id ? updatedPost : p));
    setReposts(reposts.map(p => p.id === updatedPost.id ? updatedPost : p));
    setLikedPosts(likedPosts.map(p => p.id === updatedPost.id ? updatedPost : p));
  }
  
  const handleDeletePost = async (postId: string) => {
    try {
      const postRef = doc(db, "posts", postId);
      const commentsRef = collection(postRef, "comments");
      const commentsSnapshot = await getDocs(commentsRef);
      const batch = writeBatch(db);
      commentsSnapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      await deleteDoc(postRef);
      toast({ title: "Post Deleted" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error" });
    }
  }


  if (loadingProfile || loadingAuth) {
    return (
        <div className="space-y-6">
            <Card className="overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardContent className="p-4 relative">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="-mt-24 sm:-mt-20 ml-4 sm:ml-0">
                           <Skeleton className="h-32 w-32 rounded-full border-4 border-card" />
                        </div>
                         <div className="flex-1 mt-0 sm:mt-4 space-y-3">
                            <Skeleton className="h-8 w-48" />
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-10 w-full" />
                         </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
  }

  if (!profileUser) {
    return (
        <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
                <p>User @{username} not found.</p>
            </CardContent>
        </Card>
    )
  }

  const formattedJoinDate = profileUser.joined ? `Joined ${format(new Date(profileUser.joined), 'MMMM yyyy')}` : '';
  const lastSeenText = profileUser.online 
    ? 'Online' 
    : profileUser.lastSeen 
        ? `Last seen ${formatDistanceToNowStrict(profileUser.lastSeen.toDate())} ago` 
        : null;

  const renderContentWithLinks = (content: string) => {
    if (!content) return '';
    const words = content.split(/(\s+)/);
    return words.map((word, index) => {
      const punctuation = word.match(/([.,!?;:]+)$/);
      const trailingPunctuation = punctuation ? punctuation[0] : '';
      const cleanWord = trailingPunctuation ? word.slice(0, -trailingPunctuation.length) : word;

      if (cleanWord.startsWith('#')) {
        return (
          <Fragment key={index}>
            <Link href={`/search?q=${cleanWord.substring(1)}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
              {cleanWord}
            </Link>
            {trailingPunctuation}
          </Fragment>
        );
      }
      if (cleanWord.startsWith('@')) {
         return (
           <Fragment key={index}>
            <Link href={`/profile/${cleanWord.substring(1)}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
              {cleanWord}
            </Link>
            {trailingPunctuation}
          </Fragment>
        );
      }
      return word;
    });
};

  return (
    <>
    {profileUser && (
      <FollowListDialog
        userId={profileUser.uid}
        type={followDialog.type}
        open={followDialog.open}
        onOpenChange={(open) => setFollowDialog((prev) => ({ ...prev, open }))}
      />
    )}
    <div className="space-y-6">
      <Card className="overflow-hidden border-none shadow-sm rounded-[2.5rem]">
        <div className="relative h-48 w-full bg-secondary">
          {profileUser.coverImage && <NextImage src={profileUser.coverImage} alt="Cover image" fill className="object-cover" data-ai-hint="abstract background" sizes="100vw"/>}
        </div>
        <CardContent className="p-8 relative">
          <div className="flex flex-col sm:flex-row gap-8">
            <div className="-mt-24 sm:-mt-20 ml-4 sm:ml-0 relative">
              <Avatar className="h-32 w-32 border-4 border-card shadow-xl">
                <AvatarImage src={profileUser.avatar} alt={profileUser.name} data-ai-hint="female profile" />
                <AvatarFallback className="text-2xl font-black">{profileUser.name.charAt(0)}</AvatarFallback>
              </Avatar>
              {(profileUser.isVerified || profileUser.isGreen) && (
                  <div className="absolute bottom-1 right-1 bg-background rounded-full p-1 shadow-lg">
                      <BadgeCheck className={cn("h-7 w-7 text-white", profileUser.isVerified ? "fill-blue-500" : "fill-green-500")} />
                  </div>
              )}
            </div>
            <div className="flex-1 mt-0 sm:mt-4">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-black font-headline tracking-tighter">{profileUser.name}</h2>
                        {(profileUser.isVerified || profileUser.isGreen) && (
                             <BadgeCheck className={cn("h-6 w-6 text-white sm:hidden", profileUser.isVerified ? "fill-blue-500" : "fill-green-500")} />
                        )}
                        {profileUser.online && (
                             <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white border-0 text-[10px] h-5 px-1.5 font-bold uppercase">Online</Badge>
                        )}
                    </div>
                    <p className="text-muted-foreground font-medium">@{profileUser.username} {!profileUser.online && lastSeenText && `• ${lastSeenText}`}</p>
                  </div>
                  {currentUser && currentUser.uid !== profileUser.uid && (
                    <div className="flex items-center gap-2 mt-2 sm:mt-0">
                       {isFollowing ? (
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                  <Button variant="secondary" disabled={isUpdatingFollow} className="rounded-xl h-11 px-6 font-bold">
                                      {isUpdatingFollow ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserCheck className="mr-2 h-4 w-4"/>} 
                                      Following
                                  </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="rounded-xl">
                                  <DropdownMenuItem onClick={handleFollowToggle} className="text-destructive focus:text-destructive font-bold">
                                      Unfollow Student
                                  </DropdownMenuItem>
                              </DropdownMenuContent>
                          </DropdownMenu>
                       ) : (
                          <Button onClick={handleFollowToggle} disabled={isUpdatingFollow} className="rounded-xl h-11 px-8 font-black">
                            {isUpdatingFollow ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserPlus className="mr-2 h-4 w-4"/>}
                            Follow
                          </Button>
                       )}
                        <Button variant="outline" onClick={handleStartConversation} disabled={isMessaging} className="rounded-xl h-11 px-6 font-bold border-primary/20">
                            {isMessaging ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <MessageCircle className="mr-2 h-4 w-4"/>}
                            Message
                        </Button>
                    </div>
                  )}
              </div>

              <p className="mt-6 text-sm font-medium leading-relaxed">{renderContentWithLinks(profileUser.bio)}</p>
              
               <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  {profileUser.college && <span className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> {profileUser.college}</span>}
                  {profileUser.hostelHall && <span className="flex items-center gap-2"><Home className="h-4 w-4 text-primary" /> {profileUser.hostelHall}</span>}
                  {profileUser.relationshipStatus && <span className="flex items-center gap-2"><Heart className="h-4 w-4 text-primary" /> {profileUser.relationshipStatus}</span>}
                  {formattedJoinDate && <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> {formattedJoinDate}</span>}
              </div>

              <div className="mt-8 flex gap-6 text-sm">
                <button onClick={() => setFollowDialog({ open: true, type: 'following' })} className="hover:underline transition-all active:scale-95" disabled={followingCount === 0}>
                    <span className="font-black text-xl text-foreground">{followingCount}</span> <span className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest ml-1">Following</span>
                </button>
                <button onClick={() => setFollowDialog({ open: true, type: 'followers' })} className="hover:underline transition-all active:scale-95" disabled={followersCount === 0}>
                    <span className="font-black text-xl text-foreground">{followersCount}</span> <span className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest ml-1">Followers</span>
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-2xl h-14">
          <TabsTrigger value="posts" className="rounded-xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-card">Posts</TabsTrigger>
          <TabsTrigger value="replies" className="rounded-xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-card">Replies</TabsTrigger>
          <TabsTrigger value="reposts" className="rounded-xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-card">Reposts</TabsTrigger>
          <TabsTrigger value="likes" className="rounded-xl font-black text-xs uppercase tracking-widest data-[state=active]:bg-card">Likes</TabsTrigger>
        </TabsList>
        <TabsContent value="posts" className="space-y-4 mt-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onUpdatePost={handleUpdatePost} onDeletePost={handleDeletePost} />
          ))}
          {posts.length === 0 && (
            <div className="text-center py-20 bg-muted/10 rounded-[2rem] border-2 border-dashed">
                <p className="text-muted-foreground font-bold italic">@{username} hasn't shared any posts yet.</p>
            </div>
          )}
        </TabsContent>
         <TabsContent value="replies" className="space-y-4 mt-6">
          {replies.map(reply => (
            <ReplyCard key={reply.id} comment={reply} />
          ))}
          {replies.length === 0 && (
            <div className="text-center py-20 bg-muted/10 rounded-[2rem] border-2 border-dashed">
                <p className="text-muted-foreground font-bold italic">No replies yet.</p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="reposts" className="space-y-4 mt-6">
            {reposts.map((post) => (
                <PostCard key={post.id} post={post} onUpdatePost={handleUpdatePost} onDeletePost={handleDeletePost} />
            ))}
            {reposts.length === 0 && (
                <div className="text-center py-20 bg-muted/10 rounded-[2rem] border-2 border-dashed">
                    <p className="text-muted-foreground font-bold italic">No reposts shared yet.</p>
                </div>
            )}
        </TabsContent>
        <TabsContent value="likes" className="space-y-4 mt-6">
          {likedPosts.map(post => (
             <PostCard key={post.id} post={post} onUpdatePost={handleUpdatePost} onDeletePost={handleDeletePost} />
          ))}
          {likedPosts.length === 0 && (
            <div className="text-center py-20 bg-muted/10 rounded-[2rem] border-2 border-dashed">
                <p className="text-muted-foreground font-bold italic">No likes yet.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}
