
"use client";

import type { FC } from 'react';
import React, { useEffect, useState, Fragment } from 'react';
import NextImage from 'next/image';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Repeat, Share, MoreHorizontal, Flag, Trash2, Download, MessageSquareQuote, CheckCircle, Send, Loader2, BadgeCheck } from "lucide-react";
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Timestamp, doc, updateDoc, arrayUnion, arrayRemove, writeBatch, collection, getDoc, deleteDoc, onSnapshot, increment, addDoc, serverTimestamp, query, orderBy, limit, getDocs, where, runTransaction } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Progress } from '../ui/progress';

export type Post = {
  id: string;
  user: {
    uid: string;
    name: string;
    username: string;
    avatar: string;
  };
  content: string;
  mediaURL?: string;
  mediaType?: 'image' | 'video';
  poll?: {
    options: { id: number; text: string; votes: string[] }[];
    totalVotes: number;
    expiresAt: Timestamp;
  };
  stats: {
    likes: number;
    comments: number;
    reposts: number;
  };
  timestamp: Timestamp | null;
  likedBy?: string[];
  repostOf?: string;
  quoteOf?: string;
  repostedBy?: {
    uid: string;
    name: string;
  };
};

interface PostCardProps {
  post: Post;
  onUpdatePost: (post: Post) => void;
  onDeletePost: (postId: string) => void;
  onSharePost?: (post: Post) => void;
  isQuote?: boolean;
}

const PostTimestamp = ({ timestamp }: { timestamp: Timestamp | null }) => {
    const [timeAgo, setTimeAgo] = useState<string>('just now');

    useEffect(() => {
        if (!timestamp || typeof timestamp.toDate !== 'function') {
            setTimeAgo('just now');
            return;
        }
        
        const update = () => {
            try {
                const postDate = timestamp.toDate();
                const now = new Date();
                if (postDate > now) {
                    setTimeAgo('just now');
                } else {
                    setTimeAgo(formatDistanceToNow(postDate, { addSuffix: true }));
                }
            } catch (e) {
                setTimeAgo('a while ago');
            }
        };

        update();
        const interval = setInterval(update, 30000);
        return () => clearInterval(interval);
    }, [timestamp]);

    return <span className="text-[8px] text-muted-foreground lowercase font-bold truncate">{timeAgo}</span>;
};

const renderContent = (content: string) => {
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

export const PostCard: FC<PostCardProps> = ({ post, onUpdatePost, onDeletePost, onSharePost, isQuote = false }) => {
  const { toast } = useToast();
  const router = useRouter();
  const [user] = useAuthState(auth);
  const [isLiked, setIsLiked] = useState(false);
  const [isReposted, setIsReposted] = useState(false);
  const [featuredComments, setFeaturedComments] = useState<any[]>([]);
  const [quotedPost, setQuotedPost] = useState<Post | null>(null);
  const [authorBadge, setAuthorBadge] = useState<'blue' | 'green' | null>(null);
  
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [quoteContent, setQuoteContent] = useState('');
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  
  const postUser = post.user || { name: 'Deleted User', username: 'deleted', avatar: '' };
  const isAuthor = user?.uid === postUser.uid;
  const isCuria = postUser.username === 'anonymous';

  useEffect(() => {
    if (user) {
        if(post.likedBy) {
            setIsLiked(post.likedBy.includes(user.uid));
        }
        const repostRef = doc(db, 'users', user.uid, 'reposts', post.id);
        const unsubscribe = onSnapshot(repostRef, (doc) => {
            setIsReposted(doc.exists());
        }, () => {});
        return () => unsubscribe();
    }
  }, [user, post.id, post.likedBy]);

  useEffect(() => {
    if (!postUser.uid || isCuria) return;
    const unsub = onSnapshot(doc(db, 'users', postUser.uid), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            if (data.isVerified === true) setAuthorBadge('blue');
            else if (data.isGreen === true) setAuthorBadge('green');
            else setAuthorBadge(null);
        }
    });
    return () => unsub();
  }, [postUser.uid, isCuria]);

  useEffect(() => {
    if (post.quoteOf) {
        const fetchQuotedPost = async () => {
            try {
                const docRef = doc(db, 'posts', post.quoteOf!);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setQuotedPost({ id: docSnap.id, ...docSnap.data() } as Post);
                }
            } catch (e) { console.warn("Quote fetch failed:", e); }
        };
        fetchQuotedPost();
    }
  }, [post.quoteOf]);

  useEffect(() => {
    if (isQuote) return;
    const fetchTopComments = async () => {
        const targetPostId = post.repostOf || post.id;
        const colName = isCuria ? 'curia' : 'posts';
        const commentsRef = collection(db, colName, targetPostId, 'comments');
        try {
            const q = query(commentsRef, orderBy(isCuria ? 'timestamp' : 'likes', 'desc'), limit(3));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setFeaturedComments(isCuria ? comments.reverse() : comments);
            } else {
                setFeaturedComments([]);
            }
        } catch (e) {
            console.warn("Comments fetch error", e);
        }
    };
    fetchTopComments();
  }, [post.id, post.repostOf, user, isQuote, isCuria]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
        toast({ variant: "destructive", title: "Not authenticated", description: "You must be logged in to like a post." });
        return;
    }

    const newLikedState = !isLiked;
    setIsLiked(newLikedState);

    const colName = isCuria ? 'curia' : 'posts';
    const postRef = doc(db, colName, post.id);
    
    try {
        const batch = writeBatch(db);
        batch.update(postRef, {
            'stats.likes': increment(newLikedState ? 1 : -1),
            likedBy: newLikedState ? arrayUnion(user.uid) : arrayRemove(user.uid)
        });

        if (!isCuria) {
            const userLikesRef = doc(db, 'users', user.uid, 'likedPosts', post.id);
            if (newLikedState) batch.set(userLikesRef, { postId: post.id, likedAt: serverTimestamp() });
            else batch.delete(userLikesRef);

            if (newLikedState && postUser.uid !== user.uid) {
                const notificationRef = doc(collection(db, 'users', postUser.uid, 'notifications'));
                batch.set(notificationRef, {
                    type: 'like', actor: { uid: user.uid, name: user.displayName, username: user.email?.split('@')[0], avatar: user.photoURL },
                    entity: { type: 'post', id: post.id }, read: false, timestamp: serverTimestamp(),
                });

                fetch('/api/notify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      targetUid: postUser.uid,
                      title: `${user.displayName} liked your post`,
                      body: 'Someone is feeling your vibes on the campus feed.',
                      clickAction: `/post/${post.id}`,
                      type: 'like'
                    })
                }).catch(() => {});
            }
        }
        await batch.commit();
    } catch (error) { 
        console.error(error);
        setIsLiked(!newLikedState);
    }
  };

  const handleVote = async (optionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !post.poll) return;

    const colName = isCuria ? 'curia' : 'posts';
    const postRef = doc(db, colName, post.id);

    try {
        await runTransaction(db, async (transaction) => {
            const pollDoc = await transaction.get(postRef);
            const pollData = pollDoc.data()?.poll;
            if (!pollData) return;

            const userHasVoted = pollData.options.some((opt: any) => opt.votes.includes(user.uid));
            const updatedOptions = pollData.options.map((opt: any) => {
                const votes = opt.votes.filter((uid: string) => uid !== user.uid);
                if (opt.id === optionId) votes.push(user.uid);
                return { ...opt, votes };
            });

            transaction.update(postRef, {
                'poll.options': updatedOptions,
                'poll.totalVotes': userHasVoted ? pollData.totalVotes : pollData.totalVotes + 1
            });
        });
    } catch (error) { console.error("Vote failed:", error); }
  };

  const handleRepost = async () => {
    if (!user || isCuria) return;
    
    if (isReposted) {
        try {
            const userRepostsRef = doc(db, 'users', user.uid, 'reposts', post.id);
            const batch = writeBatch(db);
            batch.delete(userRepostsRef);
            batch.update(doc(db, 'posts', post.id), { 'stats.reposts': increment(-1) });
            await batch.commit();
            toast({ title: "Repost Removed" });
        } catch (e) {}
        return;
    }
    
    try {
        const batch = writeBatch(db);
        const repostDocRef = doc(collection(db, 'posts'));
        batch.set(repostDocRef, { ...post, id: repostDocRef.id, repostOf: post.id, repostedBy: { uid: user.uid, name: user.displayName }, timestamp: serverTimestamp() });
        batch.set(doc(db, 'users', user.uid, 'reposts', post.id), { repostedAt: serverTimestamp(), mirrorPostId: repostDocRef.id });
        batch.update(doc(db, 'posts', post.id), { 'stats.reposts': increment(1) });
        await batch.commit();
        toast({ title: "Post Reposted!" });
    } catch (e) {}
  };

  const handleQuoteSubmit = async () => {
    if (!user || !quoteContent.trim() || isSubmittingQuote) return;
    setIsSubmittingQuote(true);
    
    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        const userData = userDocSnap.data();

        const quotePostRef = doc(collection(db, 'posts'));
        const quotePostData = {
            user: {
                uid: user.uid,
                name: userData?.name || user.displayName,
                username: userData?.username || 'student',
                avatar: userData?.avatar || user.photoURL
            },
            content: quoteContent,
            quoteOf: post.id,
            timestamp: serverTimestamp(),
            stats: { likes: 0, comments: 0, reposts: 0 },
            likedBy: []
        };

        const batch = writeBatch(db);
        batch.set(quotePostRef, quotePostData);
        
        if (postUser.uid !== user.uid) {
            const notificationRef = doc(collection(db, 'users', postUser.uid, 'notifications'));
            batch.set(notificationRef, {
                type: 'quote',
                actor: quotePostData.user,
                entity: { type: 'post', id: quotePostRef.id },
                read: false,
                timestamp: serverTimestamp()
            });
            
            fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  targetUid: postUser.uid,
                  title: `${user.displayName} quoted your post`,
                  body: `"${quoteContent.substring(0, 50)}..."`,
                  clickAction: `/post/${quotePostRef.id}`,
                  type: 'quote'
                })
            }).catch(() => {});
        }

        const mentions = Array.from(quoteContent.matchAll(/@([a-z0-9_.]+)/gi)).map(m => m[1].toLowerCase());
        for (const username of Array.from(new Set(mentions))) {
            if (username === userData?.username) continue;
            const uq = query(collection(db, 'users'), where('username', '==', username));
            const usnap = await getDocs(uq);
            if (!usnap.empty) {
                const targetUid = usnap.docs[0].id;
                batch.set(doc(collection(db, 'users', targetUid, 'notifications')), {
                    type: 'mention',
                    actor: quotePostData.user,
                    entity: { type: 'post', id: quotePostRef.id, content: quoteContent.substring(0, 50) },
                    read: false,
                    timestamp: serverTimestamp()
                });
                
                fetch('/api/notify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      targetUid,
                      title: `@${userData?.username} mentioned you`,
                      body: quoteContent.substring(0, 50),
                      clickAction: `/post/${quotePostRef.id}`,
                      type: 'mention'
                    })
                }).catch(() => {});
            }
        }

        await batch.commit();
        setIsQuoteDialogOpen(false);
        setQuoteContent('');
        toast({ title: "Quote Posted!" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Quote Failed" });
    } finally {
        setIsSubmittingQuote(false);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSharePost) onSharePost(post);
    else {
        try {
            navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}${isCuria ? '?type=curia' : ''}`);
            toast({ title: "Link Copied!" });
        } catch (err) { console.warn("Clipboard failed:", err); }
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeletePost(post.id);
  }

  const renderPoll = () => {
    if (!post.poll) return null;
    const userVote = user ? post.poll.options.find(opt => opt.votes.includes(user.uid)) : null;
    const hasVoted = !!userVote;

    return (
        <div className="mt-4 space-y-3 p-4 border rounded-xl bg-muted/20">
            {post.poll.options.map(opt => {
                const percent = post.poll!.totalVotes > 0 ? (opt.votes.length / post.poll!.totalVotes) * 100 : 0;
                return (
                    <div key={opt.id} className="space-y-1">
                        {hasVoted ? (
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-semibold">
                                    <span className="flex items-center gap-2 truncate pr-2">{opt.text} {userVote?.id === opt.id && <CheckCircle className="h-3 w-3 text-primary shrink-0" />}</span>
                                    <span className="shrink-0">{percent.toFixed(0)}%</span>
                                </div>
                                <Progress value={percent} className="h-2" />
                            </div>
                        ) : (
                            <Button variant="outline" className="w-full justify-start h-9 text-sm" onClick={(e) => handleVote(opt.id, e)}><span className="truncate">{opt.text}</span></Button>
                        )}
                    </div>
                );
            })}
            <p className="text-[10px] text-muted-foreground">{post.poll.totalVotes} votes</p>
        </div>
    );
  };

  const cardClassName = cn(
      "overflow-hidden cursor-pointer transition-colors w-full",
      isQuote ? "border bg-card p-3 rounded-xl mt-2 hover:bg-muted/10" : "hover:bg-muted/5",
      !isQuote && "p-0"
  );

  const handleCardClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      router.push(`/post/${post.repostOf || post.id}${isCuria ? '?type=curia' : ''}`);
  };

  return (
    <>
    <Dialog open={isQuoteDialogOpen} onOpenChange={setIsQuoteDialogOpen}>
        <DialogContent className="max-w-xl rounded-[2rem]">
            <DialogHeader>
                <DialogTitle className="text-2xl font-black">Quote Post</DialogTitle>
                <DialogDescription>Add your thoughts to this student's post.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <Textarea 
                    placeholder="What's your take?" 
                    className="min-h-[100px] rounded-2xl bg-muted/20 border-none p-4 font-medium"
                    value={quoteContent}
                    onChange={e => setQuoteContent(e.target.value)}
                />
                <div className="opacity-60 scale-[0.95] pointer-events-none origin-top">
                    <PostCard post={post} isQuote onUpdatePost={() => {}} onDeletePost={() => {}} />
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" className="rounded-xl" onClick={() => setIsQuoteDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleQuoteSubmit} disabled={isSubmittingQuote || !quoteContent.trim()} className="rounded-xl font-black px-8">
                    {isSubmittingQuote ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <MessageSquareQuote className="mr-2 h-4 w-4" />}
                    Post Quote
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <Card className={cardClassName} onClick={handleCardClick}>
      {!isQuote && post.repostedBy && (
        <div className="flex items-center gap-2 px-4 pt-2 text-xs text-muted-foreground font-semibold">
            <Repeat className="h-3 w-3" />
            <span className="truncate">{post.repostedBy.name} reposted</span>
        </div>
      )}
      <div className={cn(!isQuote && "p-4", isQuote && "p-0")}>
        <div className="flex flex-row items-start gap-3">
          <Link href={isCuria ? "#" : `/profile/${postUser.username}`} onClick={(e) => e.stopPropagation()} className="shrink-0 relative group">
            <Avatar className={cn(isQuote ? "h-6 w-6" : "h-11 w-11 border-2 border-primary/5")}>
              <AvatarImage src={isCuria ? undefined : postUser.avatar} />
              <AvatarFallback>{postUser.name.charAt(0)}</AvatarFallback>
            </Avatar>
            {authorBadge && !isCuria && (
                 <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 shadow-sm">
                    <BadgeCheck className={cn("h-4 w-4 text-white", authorBadge === 'blue' ? "fill-blue-500" : "fill-green-500")} />
                 </div>
            )}
          </Link>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1 min-w-0">
                        <span className="font-black text-sm hover:underline truncate shrink min-w-0 flex items-center gap-1">
                            {postUser.name}
                            {authorBadge && <BadgeCheck className={cn("h-3.5 w-3.5 text-white shrink-0 sm:hidden", authorBadge === 'blue' ? "fill-blue-500" : "fill-green-500")} />}
                        </span>
                        {authorBadge && !isCuria && (
                             <BadgeCheck className={cn("h-4 w-4 hidden sm:block text-white", authorBadge === 'blue' ? "fill-blue-500" : "fill-green-500")} />
                        )}
                    </div>
                    {!isQuote && !isCuria && (
                        <span className="text-xs text-muted-foreground truncate opacity-70">@{postUser.username}</span>
                    )}
                    {!isQuote && (
                        <div className="mt-0.5">
                            <PostTimestamp timestamp={post.timestamp} />
                        </div>
                    )}
                </div>
                {!isQuote && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="-mt-1 shrink-0 h-8 w-8 rounded-full"><MoreHorizontal className="h-4 w-4"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            {isAuthor && <DropdownMenuItem onClick={handleDelete} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>}
                            <DropdownMenuItem className="text-destructive"><Flag className="mr-2 h-4 w-4" />Report</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
            <p className={cn("whitespace-pre-wrap mt-2 break-words overflow-hidden leading-relaxed break-all", isQuote ? "text-sm" : "text-base font-medium")}>
                {renderContent(post.content)}
            </p>
            {renderPoll()}
            {quotedPost && (
                <div className="mt-2 pointer-events-none">
                    <PostCard post={quotedPost} isQuote onUpdatePost={() => {}} onDeletePost={() => {}} />
                </div>
            )}
          </div>
        </div>
      </div>
      
      {post.mediaURL && (
        <div className={cn("px-4 pb-2 -mt-2", !isQuote && "ml-0 sm:ml-[56px]", isQuote && "px-0 pb-0 mt-2 ml-0")}>
            <div className={cn("relative w-full overflow-hidden rounded-2xl border bg-black", isQuote ? "max-h-[300px]" : "max-h-[70vh]")}>
                {post.mediaType === 'image' ? (
                    <NextImage src={post.mediaURL} alt="Media" width={0} height={0} sizes="100vw" style={{ width: '100%', height: 'auto' }} className="object-contain" />
                ) : (
                    <video src={post.mediaURL} controls muted={isQuote} loop playsInline className="w-full h-full object-contain" />
                )}
            </div>
        </div>
      )}

      {!isQuote && (
        <CardFooter className="flex-col items-start px-4 py-0 pb-2 ml-0 sm:ml-12">
          <div className="flex w-full justify-between max-w-sm text-muted-foreground border-b pb-2 mb-2">
              <Button variant="ghost" className="flex items-center gap-2 hover:text-red-500 p-0 h-9" onClick={handleLike}>
                  <Heart className={cn("h-4 w-4", isLiked && "fill-red-500 text-red-500")} />
                  <span className="text-[10px] font-black">{post.stats?.likes || 0}</span>
              </Button>
              <Button variant="ghost" className="flex items-center gap-2 hover:text-primary p-0 h-9" onClick={(e) => e.stopPropagation()}>
                  <Link href={`/post/${post.id}${isCuria ? '?type=curia' : ''}`} className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-[10px] font-black">{post.stats?.comments || 0}</span>
                  </Link>
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" className="flex items-center gap-2 hover:text-green-500 p-0 h-9" disabled={isCuria}>
                        <Repeat className={cn("h-4 w-4", isReposted && "text-green-500")} />
                        <span className="text-[10px] font-black">{post.stats?.reposts || 0}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="rounded-xl">
                    <DropdownMenuItem onClick={handleRepost} className="gap-2 font-bold py-3">
                        <Repeat className="h-4 w-4" /> {isReposted ? "Undo Repost" : "Repost"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsQuoteDialogOpen(true)} className="gap-2 font-bold py-3">
                        <MessageSquareQuote className="h-4 w-4" /> Quote Post
                    </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="ghost" size="icon" className="hover:text-primary p-0 h-9 w-9" onClick={handleShare}>
                  <Share className="h-4 w-4" />
              </Button>
          </div>
          
          {featuredComments.length > 0 && (
              <div className="w-full space-y-3 pb-3">
                  {featuredComments.map((comment) => (
                      <div key={comment.id} className="flex gap-2 text-[11px]">
                          <span className="font-bold text-primary shrink-0">@{comment.user.username || 'anon'}:</span>
                          <p className="line-clamp-2 text-muted-foreground break-words leading-snug">{comment.content}</p>
                      </div>
                  ))}
              </div>
          )}
        </CardFooter>
      )}
    </Card>
    </>
  );
};
