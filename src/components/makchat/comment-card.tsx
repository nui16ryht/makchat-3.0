
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from 'date-fns';
import { Timestamp, doc, updateDoc, arrayUnion, arrayRemove, addDoc, collection, query, orderBy, onSnapshot, getDoc, deleteDoc, serverTimestamp, writeBatch, getDocs, where, increment } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Heart, MessageSquare, Send, MoreHorizontal, Trash2, Loader2, BadgeCheck, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export type Comment = {
  id: string;
  postId: string;
  parentId?: string | null;
  postAuthorId: string;
  user: {
    uid: string;
    name: string;
    username: string;
    avatar: string;
  };
  content: string;
  timestamp: Timestamp;
  likes: number;
  likedBy: string[];
  replies?: Comment[]; // Populated by the tree-builder in parent
};

interface CommentCardProps {
  comment: Comment;
  onCommentUpdate: (comment: Comment) => void;
  onCommentDelete: (commentId: string) => void;
  depth?: number;
}

const formatTimestamp = (timestamp: Timestamp | null) => {
    if (!timestamp) return 'just now';
    try {
        const d = timestamp.toDate();
        return `${formatDistanceToNow(d)} ago`;
    } catch (e) {
        return 'recently';
    }
}

export const CommentCard: React.FC<CommentCardProps> = ({ comment, onCommentUpdate, onCommentDelete, depth = 0 }) => {
  const [user] = useAuthState(auth);
  const { toast } = useToast();
  const [isLiked, setIsLiked] = useState(user ? comment.likedBy?.includes(user.uid) : false);
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [authorBadge, setAuthorBadge] = useState<'blue' | 'green' | null>(null);

  const commentUser = comment.user || { name: 'Deleted User', username: 'deleted', avatar: '' };
  const isCuria = commentUser.username === 'anonymous';

  useEffect(() => {
    setIsLiked(user ? comment.likedBy?.includes(user.uid) : false);
  }, [user, comment.likedBy]);

  useEffect(() => {
    if (!commentUser.uid || isCuria) return;
    const unsub = onSnapshot(doc(db, 'users', commentUser.uid), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            if (data.isVerified === true) setAuthorBadge('blue');
            else if (data.isGreen === true) setAuthorBadge('green');
            else setAuthorBadge(null);
        }
    });
    return () => unsub();
  }, [commentUser.uid, isCuria]);

  const handleLike = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!user) {
        toast({ variant: 'destructive', title: "Please log in to like comments." });
        return;
      }
      const colName = isCuria ? 'curia' : 'posts';
      const commentRef = doc(db, colName, comment.postId, 'comments', comment.id);
      const newLikedState = !isLiked;
      const newLikesCount = (comment.likes || 0) + (newLikedState ? 1 : -1);
      
      try {
        await updateDoc(commentRef, {
            likes: newLikesCount,
            likedBy: newLikedState ? arrayUnion(user.uid) : arrayRemove(user.uid)
        });
      } catch (error) {
        console.error("Error liking comment:", error);
      }
  };

  const handleReplySubmit = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: "Please log in to reply." });
      return;
    }
    if (!replyContent.trim()) return;

    setIsSubmittingReply(true);
    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        const userData = userDocSnap.data();

        const batch = writeBatch(db);
        const colName = isCuria ? 'curia' : 'posts';
        const postRef = doc(db, colName, comment.postId);
        
        // In Curia, use consistent anonymity
        const replyUser = isCuria ? {
            uid: user.uid,
            name: comment.user.name, 
            username: "anonymous",
            avatar: ""
        } : {
            uid: user.uid,
            name: userData?.name || user.displayName,
            username: userData?.username || 'student',
            avatar: userData?.avatar || user.photoURL,
        };

        const replyRef = doc(collection(db, colName, comment.postId, 'comments'));
        const replyData = {
            user: replyUser,
            content: replyContent,
            timestamp: serverTimestamp(),
            likes: 0,
            likedBy: [],
            postId: comment.postId,
            parentId: comment.id,
            postAuthorId: comment.postAuthorId,
        };
        
        batch.set(replyRef, replyData);
        batch.update(postRef, { 'stats.comments': increment(1) });
        
        if (!isCuria) {
            // Notifications and Mentions
            if (commentUser.uid !== user.uid) {
                batch.set(doc(collection(db, 'users', commentUser.uid, 'notifications')), {
                    type: 'reply',
                    actor: replyData.user,
                    entity: { type: 'post', id: comment.postId, content: replyContent.substring(0, 50) },
                    read: false,
                    timestamp: serverTimestamp(),
                });
                
                fetch('/api/notify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      targetUid: commentUser.uid,
                      title: `${userData?.name || user.displayName} replied to your comment`,
                      body: `"${replyContent.substring(0, 50)}..."`,
                      clickAction: `/post/${comment.postId}`,
                      type: 'reply'
                    })
                }).catch(() => {});
            }

            // Mentions in replies
            const mentions = Array.from(replyContent.matchAll(/@([a-z0-9_.]+)/gi)).map(m => m[1].toLowerCase());
            for (const username of Array.from(new Set(mentions))) {
                if (username === userData?.username) continue;
                const uq = query(collection(db, 'users'), where('username', '==', username));
                const usnap = await getDocs(uq);
                if (!usnap.empty) {
                    const targetUid = usnap.docs[0].id;
                    batch.set(doc(collection(db, 'users', targetUid, 'notifications')), {
                        type: 'mention',
                        actor: replyData.user,
                        entity: { type: 'post', id: comment.postId, content: replyContent.substring(0, 50) },
                        read: false,
                        timestamp: serverTimestamp()
                    });
                }
            }
        }

        await batch.commit();
        setReplyContent('');
        setShowReply(false);
        toast({ title: "Reply Posted!" });
    } catch(error) {
        console.error("Error submitting reply:", error);
        toast({ variant: 'destructive', title: "Error" });
    } finally {
        setIsSubmittingReply(false);
    }
  };

  const renderContent = (content: string) => {
    if (!content) return '';
    const words = content.split(/(\s+)/);
    return words.map((word, index) => {
      if (word.startsWith('@') && !isCuria) {
        const username = word.slice(1).replace(/[.,!?;:]+$/, '');
        return (
          <Link key={index} href={`/profile/${username}`} className="text-primary font-bold hover:underline" onClick={(e) => e.stopPropagation()}>
            {word}
          </Link>
        );
      }
      return word;
    });
  };

  const indentationClass = depth > 0 ? "ml-4 sm:ml-8 border-l-2 border-primary/10 pl-4" : "";

  return (
    <div className={cn("space-y-4", indentationClass)}>
        <Card className="bg-secondary/30 border-none rounded-2xl shadow-none">
          <CardContent className="p-4 flex items-start gap-4">
            <Link href={isCuria ? "#" : `/profile/${commentUser.username}`} className="relative shrink-0">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={isCuria ? undefined : commentUser.avatar} alt={commentUser.name} />
                    <AvatarFallback>{commentUser.name.charAt(0)}</AvatarFallback>
                </Avatar>
                {authorBadge && !isCuria && (
                     <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 shadow-sm">
                        <BadgeCheck className={cn("h-3.5 w-3.5 text-white", authorBadge === 'blue' ? "fill-blue-500" : "fill-green-500")} />
                     </div>
                )}
            </Link>
            <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1">
                            <Link href={isCuria ? "#" : `/profile/${commentUser.username}`} className="font-bold text-sm hover:underline truncate">{commentUser.name}</Link>
                            {authorBadge && !isCuria && <BadgeCheck className={cn("h-3.5 w-3.5 text-white", authorBadge === 'blue' ? "fill-blue-500" : "fill-green-500")} />}
                        </div>
                        <p className="text-[8px] font-bold text-muted-foreground lowercase">{formatTimestamp(comment.timestamp)}</p>
                    </div>
                     {user?.uid === commentUser.uid && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full shrink-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="rounded-xl">
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive font-bold">
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-[2rem]">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="text-2xl font-black">Delete Comment?</AlertDialogTitle>
                                            <AlertDialogDescription className="font-medium">
                                                This action is permanent and cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => onCommentDelete(comment.id)} className="rounded-xl bg-destructive">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
                <p className="text-sm font-medium leading-relaxed break-words">{renderContent(comment.content)}</p>
                <div className="flex items-center gap-4 text-muted-foreground text-[10px] font-black uppercase tracking-widest pt-1">
                    <Button variant="ghost" size="sm" className="flex items-center gap-1.5 p-1 h-auto hover:text-red-500 transition-colors" onClick={handleLike}>
                        <Heart className={cn("h-4 w-4", isLiked && "fill-red-500 text-red-500")} />
                        <span>{comment.likes || 0}</span>
                    </Button>
                     <Button variant="ghost" size="sm" className="flex items-center gap-1.5 p-1 h-auto hover:text-primary transition-colors" onClick={() => setShowReply(!showReply)}>
                        <Reply className="h-4 w-4" />
                        <span>Reply</span>
                    </Button>
                </div>
                {showReply && (
                     <div className="flex items-start gap-3 pt-3 animate-in slide-in-from-top-2 duration-300">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={isCuria ? undefined : (user?.photoURL ?? undefined)} />
                            <AvatarFallback>{isCuria ? 'A' : (user?.displayName?.charAt(0) ?? 'U')}</AvatarFallback>
                        </Avatar>
                        <div className="relative w-full">
                            <Textarea 
                                placeholder={isCuria ? "Reply anonymously..." : `Reply to @${commentUser.username}...`}
                                className="bg-card pr-12 text-sm rounded-xl min-h-[40px] p-3 font-medium border-none shadow-inner"
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                autoFocus
                                minRows={1}
                            />
                            <Button 
                                size="icon" 
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg" 
                                onClick={handleReplySubmit}
                                disabled={isSubmittingReply || !replyContent.trim()}
                            >
                                {isSubmittingReply ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
          </CardContent>
        </Card>

        {/* RECURSIVE REPLIES */}
        {comment.replies && comment.replies.length > 0 && (
            <div className="space-y-4">
                {comment.replies.map((reply) => (
                    <CommentCard 
                        key={reply.id} 
                        comment={reply} 
                        onCommentUpdate={onCommentUpdate} 
                        onCommentDelete={onCommentDelete} 
                        depth={depth + 1}
                    />
                ))}
            </div>
        )}
    </div>
  );
};
