
"use client";

import React, { useEffect, useState, useRef, Fragment } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard, type Post } from "@/components/makchat/post-card";
import { GraduationCap, Heart, Edit, Home, Camera, Loader2, CalendarDays, ShieldCheck, ShieldAlert, Mail, Send, BadgeCheck } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, storage } from '@/lib/firebase';
import { doc, updateDoc, collection, query, where, getDocs, deleteDoc, writeBatch, onSnapshot, Timestamp, orderBy, serverTimestamp, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { type Comment } from '@/components/makchat/comment-card';
import { ReplyCard } from '@/components/makchat/reply-card';
import { FollowListDialog } from '@/components/makchat/follow-list-dialog';
import { CropImageDialog } from '@/components/makchat/crop-image-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import NextImage from 'next/image';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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
  studentNumber?: string;
  registrationNumber?: string;
};

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

export default function MyProfilePage() {
  const [user, loadingAuth] = useAuthState(auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [reposts, setReposts] = useState<Post[]>([]);
  
  const { toast } = useToast();

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followDialog, setFollowDialog] = useState<{ open: boolean, type: 'followers' | 'following' }>({ open: false, type: 'followers' });

  // States for image upload
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverCropSource, setCoverCropSource] = useState<string | null>(null);
  const [isCoverCropDialogOpen, setIsCoverCropDialogOpen] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  useEffect(() => {
    if (loadingAuth || !user) return;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(userDocRef, (doc) => {
        if(doc.exists()) {
            setProfile({ uid: doc.id, ...doc.data() } as UserProfile);
        }
    }, () => {});

    const postsQuery = query(collection(db, 'posts'), where('user.uid', '==', user.uid));
    const unsubPosts = onSnapshot(postsQuery, (snap) => {
      let fetchedPosts = snap.docs.map(d => ({id: d.id, ...d.data()} as Post));
      fetchedPosts = fetchedPosts.sort((a,b) => {
          const timeA = a.timestamp?.toMillis?.() ?? 0;
          const timeB = b.timestamp?.toMillis?.() ?? 0;
          return timeB - timeA;
      });
      setPosts(fetchedPosts)
    }, () => {});

    const unsubReplies = onSnapshot(query(collection(db, 'comments'), where('user.uid', '==', user.uid)), (snap) => {
        let fetchedReplies = snap.docs.map(d => ({id: d.id, ...d.data()} as Comment));
        fetchedReplies = fetchedReplies.sort((a, b) => {
          const timeA = a.timestamp?.toMillis?.() ?? 0;
          const timeB = b.timestamp?.toMillis?.() ?? 0;
          return timeB - timeA;
        });
        setReplies(fetchedReplies);
    }, () => {});
    
    const repostsRef = collection(db, 'users', user.uid, 'reposts');
    const unsubReposts = onSnapshot(repostsRef, async (repostSnap) => {
        const repostIds = repostSnap.docs.map(d => d.id);
        if (repostIds.length > 0) {
            const repostsQuery = query(collection(db, 'posts'), where('__name__', 'in', repostIds.slice(0, 30)));
            const repostsDataSnap = await getDocs(repostsQuery);
            setReposts(repostsDataSnap.docs.map(d => ({id: d.id, ...d.data()} as Post)));
        } else {
            setReposts([]);
        }
    }, () => {});
    
    const likedPostsRef = collection(db, 'users', user.uid, 'likedPosts');
    const unsubLikes = onSnapshot(likedPostsRef, async (likeSnap) => {
        const likedPostIds = likeSnap.docs.map(d => d.id);
        if (likedPostIds.length > 0) {
            const likedPostsQuery = query(collection(db, 'posts'), where('__name__', 'in', likedPostIds.slice(0, 30)));
            const likedPostsDataSnap = await getDocs(likedPostsQuery);
            setLikedPosts(likedPostsDataSnap.docs.map(d => ({id: d.id, ...d.data()} as Post)));
        } else {
            setLikedPosts([]);
        }
    }, () => {});

    const unsubFollowers = onSnapshot(collection(db, 'users', user.uid, 'followers'), (snapshot) => setFollowersCount(snapshot.size), () => {});
    const unsubFollowing = onSnapshot(collection(db, 'users', user.uid, 'following'), (snapshot) => setFollowingCount(snapshot.size), () => {});
    
    return () => {
        unsubProfile();
        unsubPosts();
        unsubReplies();
        unsubReposts();
        unsubLikes();
        unsubFollowers();
        unsubFollowing();
    }
  }, [user, loadingAuth]);

  const handleUpdatePost = async (updatedPost: Post) => {
    setPosts(posts.map(p => p.id === updatedPost.id ? updatedPost : p));
    setLikedPosts(likedPosts.map(p => p.id === updatedPost.id ? updatedPost : p));
    setReposts(reposts.map(p => p.id === updatedPost.id ? updatedPost : p));
  }
  
  const handleDeletePost = async (postId: string) => {
     try {
      const postRef = doc(db, "posts", postId);
      const commentsRef = collection(postRef, "comments");
      
      const commentsSnapshot = await getDocs(commentsRef);
      const batch = writeBatch(db);
      commentsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      await deleteDoc(postRef);

      toast({ title: "Post Deleted" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error" });
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
        setIsCropDialogOpen(true);
      };
      reader.readAsDataURL(file);
    }
  }

  const handleSaveCroppedImage = async (croppedImageBlob: Blob | null) => {
    if (!croppedImageBlob || !user) {
        setIsCropDialogOpen(false);
        return;
    }
    
    setIsCropDialogOpen(false);
    setIsUploading(true);
    const toastId = toast({
      title: 'Updating Avatar...',
      description: <div className="flex items-center gap-2"><Loader2 className="animate-spin h-4 w-4" /> Please wait.</div>,
    });

    try {
        const avatarFile = new File([croppedImageBlob], "avatar.jpeg", { type: "image/jpeg" });
        const avatarRef = ref(storage, `avatars/${user.uid}/profile.jpg`);
        const snapshot = await uploadBytes(avatarRef, avatarFile);
        const newAvatarUrl = await getDownloadURL(snapshot.ref);

        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, { avatar: newAvatarUrl });

        if(user.photoURL !== newAvatarUrl) {
            await updateProfile(user, { photoURL: newAvatarUrl });
        }

        toastId.update({ id: toastId.id, title: "Profile Picture Updated!" });
    } catch (error) {
        toastId.update({ id: toastId.id, variant: 'destructive', title: "Upload Failed" });
    } finally {
        setIsUploading(false);
        setAvatarPreview(null);
    }
  }

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverCropSource(reader.result as string);
        setIsCoverCropDialogOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveCroppedCoverImage = async (croppedImageBlob: Blob | null) => {
    if (!croppedImageBlob || !user) {
        setIsCoverCropDialogOpen(false);
        return;
    }
    
    setIsCoverCropDialogOpen(false);
    setIsUploadingCover(true);
    const toastId = toast({
      title: 'Updating Cover...',
      description: <div className="flex items-center gap-2"><Loader2 className="animate-spin h-4 w-4" /> Please wait.</div>,
    });

    try {
        const coverFile = new File([croppedImageBlob], "cover.jpeg", { type: "image/jpeg" });
        const coverRef = ref(storage, `covers/${user.uid}/cover.jpg`);
        const snapshot = await uploadBytes(coverRef, coverFile);
        const newCoverUrl = await getDownloadURL(snapshot.ref);

        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, { coverImage: newCoverUrl });

        toastId.update({ id: toastId.id, title: "Cover Image Updated!" });
    } catch (error) {
        toastId.update({ id: toastId.id, variant: 'destructive', title: "Upload Failed" });
    } finally {
        setIsUploadingCover(false);
        setCoverCropSource(null);
    }
  }


  if (loadingAuth || !profile) {
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
    )
  }
  
  const formattedJoinDate = profile.joined ? `Joined ${format(new Date(profile.joined), 'MMMM yyyy')}` : '';

  return (
    <>
    {profile && (
        <FollowListDialog
            userId={profile.uid}
            type={followDialog.type}
            open={followDialog.open}
            onOpenChange={(open) => setFollowDialog((prev) => ({ ...prev, open }))}
        />
    )}
    {avatarPreview && (
        <CropImageDialog 
            imageSrc={avatarPreview}
            open={isCropDialogOpen}
            onOpenChange={setIsCropDialogOpen}
            onSave={handleSaveCroppedImage}
            aspect={1}
        />
    )}
    {coverCropSource && (
        <CropImageDialog 
            imageSrc={coverCropSource}
            open={isCoverCropDialogOpen}
            onOpenChange={setIsCoverCropDialogOpen}
            onSave={handleSaveCroppedCoverImage}
            aspect={3 / 1}
        />
    )}

    <div className="space-y-6">
      <Card className="overflow-hidden border-none shadow-sm rounded-[2.5rem]">
        <div className="relative h-48 w-full bg-secondary group">
          {profile.coverImage && <NextImage src={profile.coverImage} alt="Cover image" fill className="object-cover" data-ai-hint="abstract background" sizes="100vw"/>}
          <label
            htmlFor="cover-upload"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'absolute bottom-4 right-4 cursor-pointer z-10 rounded-full h-10 px-6 font-bold bg-white/20 backdrop-blur-md border-white/40 text-white hover:bg-white/40',
              isUploadingCover && 'pointer-events-none'
            )}
          >
            {isUploadingCover ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Camera className="mr-2 h-4 w-4"/>}
            {isUploadingCover ? "Uploading..." : "Change Cover"}
          </label>
          <input id="cover-upload" type="file" accept="image/*" ref={coverInputRef} onChange={handleCoverImageChange} className="hidden" />
        </div>
        <CardContent className="p-8 relative">
          <div className="flex flex-col sm:flex-row gap-8">
            <div className="-mt-24 sm:-mt-20 ml-4 sm:ml-0 relative">
               <input id="avatar-upload" type="file" accept="image/*" ref={avatarInputRef} onChange={handleAvatarChange} className="hidden" />
               <label htmlFor="avatar-upload" className="relative group rounded-full block cursor-pointer" >
                <Avatar className="h-32 w-32 border-4 border-card shadow-xl">
                    <AvatarImage src={profile.avatar} alt={profile.name} data-ai-hint="male profile" />
                    <AvatarFallback className="text-2xl font-black">{profile.name.substring(0,2)}</AvatarFallback>
                </Avatar>
                <div className={cn("absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity", isUploading && "opacity-100")}>
                  {isUploading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Camera className="h-8 w-8" />}
                </div>
              </label>
              {(profile.isVerified || profile.isGreen) && (
                  <div className="absolute bottom-1 right-1 bg-background rounded-full p-1 shadow-lg">
                      <BadgeCheck className={cn("h-7 w-7 text-white", profile.isVerified ? "fill-blue-500" : "fill-green-500")} />
                  </div>
              )}
            </div>
            <div className="flex-1 mt-0 sm:mt-4">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-black font-headline tracking-tighter">{profile.name}</h2>
                        {(profile.isVerified || profile.isGreen) && (
                            <BadgeCheck className={cn("h-6 w-6 text-white", profile.isVerified ? "fill-blue-500" : "fill-green-500")} />
                        )}
                        <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white border-0 text-[10px] h-5 px-1.5 font-bold uppercase">Online</Badge>
                    </div>
                    <p className="text-muted-foreground font-medium">@{profile.username}</p>
                  </div>
                  <Button asChild variant="outline" className="rounded-xl h-11 px-6 font-bold border-primary/20">
                    <Link href="/profile/me/edit">
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Profile
                    </Link>
                  </Button>
              </div>
              
              <p className="mt-6 text-sm font-medium leading-relaxed">{renderContentWithLinks(profile.bio)}</p>
              
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  {profile.college && <span className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> {profile.college}</span>}
                  {profile.hostelHall && <span className="flex items-center gap-2"><Home className="h-4 w-4 text-primary" /> {profile.hostelHall}</span>}
                  {profile.relationshipStatus && <span className="flex items-center gap-2"><Heart className="h-4 w-4 text-primary" /> {profile.relationshipStatus}</span>}
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
            <PostCard key={post.id} post={post} onUpdatePost={handleUpdatePost} onDeletePost={handleDeletePost}/>
          ))}
          {posts.length === 0 && (
            <div className="text-center py-20 bg-muted/10 rounded-[2rem] border-2 border-dashed">
                <p className="text-muted-foreground font-bold italic">You haven't shared any posts yet.</p>
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
          {reposts.map(post => (
             <PostCard key={post.id} post={post} onUpdatePost={() => {}} onDeletePost={() => {}} />
          ))}
          {reposts.length === 0 && (
            <div className="text-center py-20 bg-muted/10 rounded-[2rem] border-2 border-dashed">
                <p className="text-muted-foreground font-bold italic">No reposts yet.</p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="likes" className="space-y-4 mt-6">
          {likedPosts.map(post => (
             <PostCard key={post.id} post={post} onUpdatePost={() => {}} onDeletePost={() => {}} />
          ))}
          {likedPosts.length === 0 && (
            <div className="text-center py-20 bg-muted/10 rounded-[2rem] border-2 border-dashed">
                <p className="text-muted-foreground font-bold italic">No liked posts yet.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}
