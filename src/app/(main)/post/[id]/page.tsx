
"use client";

import React, { useEffect, useState, useMemo, useRef, Suspense, Fragment } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs, updateDoc, deleteDoc, writeBatch, where, limit, startAfter, QueryDocumentSnapshot, increment } from 'firebase/firestore';
import { PostCard, type Post } from '@/components/makchat/post-card';
import { CommentCard, type Comment } from '@/components/makchat/comment-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import Link from 'next/link';

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

function PostDetailContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const postId = params.id as string;
    
    const [postType, setPostType] = useState<string | null>(null);
    const [user, loadingAuth] = useAuthState(auth);
    const { toast } = useToast();

    const [post, setPost] = useState<Post | null>(null);
    const [commentsTree, setCommentsTree] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const nickname = useMemo(() => user ? generateNickname(user.uid) : "Anonymous", [user]);

    // Initial detection of post type
    useEffect(() => {
        if (!postId) return;
        const detectType = async () => {
            const explicitType = searchParams.get('type');
            if (explicitType === 'curia') {
                setPostType('curia');
                return;
            }
            
            const postRef = doc(db, 'posts', postId);
            const snap = await getDoc(postRef);
            if (snap.exists()) {
                setPostType('posts');
            } else {
                const curiaRef = doc(db, 'curia', postId);
                const curiaSnap = await getDoc(curiaRef);
                if (curiaSnap.exists()) {
                    setPostType('curia');
                }
            }
        };
        detectType();
    }, [postId, searchParams]);

    // Fetch Post
    useEffect(() => {
        if (!postId || !postType) return;
        const unsubscribe = onSnapshot(doc(db, postType, postId), (doc) => {
            if (doc.exists()) {
                setPost({ id: doc.id, ...doc.data() } as Post);
            } else {
                setPost(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [postId, postType]);

    // Fetch and Tree-ify Comments
    useEffect(() => {
        if (!postId || !postType) return;
        const q = query(collection(db, postType, postId, 'comments'), orderBy('timestamp', 'asc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const rawComments = snapshot.docs.map(d => ({ 
                id: d.id, 
                postId: postId, // Explicitly pass postId context for replies
                ...d.data() 
            } as Comment));
            
            // Build tree
            const tree: Comment[] = [];
            const map: Record<string, Comment> = {};
            
            rawComments.forEach(c => {
                c.replies = [];
                map[c.id] = c;
            });
            
            rawComments.forEach(c => {
                if (c.parentId && map[c.parentId]) {
                    map[c.parentId].replies!.push(c);
                } else {
                    tree.push(c);
                }
            });

            // Sort top-level by timestamp descending
            setCommentsTree(tree.reverse());
        });

        return () => unsubscribe();
    }, [postId, postType]);

    const handleAddComment = async () => {
        if (!user || user.isAnonymous) { toast({ variant: 'destructive', title: "Please log in." }); return; }
        if (!newComment.trim() || !post || !postType) return;
        setIsSubmitting(true);
        try {
            const userDocSnap = await getDoc(doc(db, 'users', user.uid));
            const userData = userDocSnap.data();
            
            const batch = writeBatch(db);
            const commentRef = doc(collection(db, postType, postId, 'comments'));
            const postRef = doc(db, postType, postId);
            
            const commentUser = postType === 'curia' ? {
                uid: user.uid,
                name: nickname,
                username: "anonymous",
                avatar: ""
            } : {
                uid: user.uid,
                name: userData?.name || user.displayName,
                username: userData?.username || 'student',
                avatar: userData?.avatar || user.photoURL
            };

            const commentData = {
                user: commentUser,
                postId, postAuthorId: post.user.uid, content: newComment, timestamp: serverTimestamp(), likes: 0, likedBy: [],
            };
            
            batch.set(commentRef, commentData);
            batch.update(postRef, { 'stats.comments': increment(1) });
            
            if (postType === 'posts') {
                if (post.user.uid !== user.uid) {
                    batch.set(doc(collection(db, 'users', post.user.uid, 'notifications')), {
                        type: 'comment',
                        actor: commentUser,
                        entity: { type: 'post', id: post.id, content: newComment.substring(0, 50) },
                        read: false, timestamp: serverTimestamp(),
                    });
                }
            }

            await batch.commit();
            setNewComment('');
        } catch (error) { toast({ variant: 'destructive', title: "Error" }); }
        finally { setIsSubmitting(false); }
    }

    const handleCommentUpdate = (updated: Comment) => {
        // Handled by real-time onSnapshot listeners
    }

    const handleCommentDelete = async (id: string) => {
        if (!postType) return;
        try {
            const batch = writeBatch(db);
            batch.delete(doc(db, postType, postId, 'comments', id));
            batch.update(doc(db, postType, postId), { 'stats.comments': increment(-1) });
            await batch.commit();
            toast({ title: "Comment Deleted" });
        } catch (e) { toast({ variant: 'destructive', title: "Error" }); }
    }

    if (loading || loadingAuth) {
        return <div className="p-4 space-y-4 max-w-2xl mx-auto"><Skeleton className="h-48 w-full rounded-2xl" /><Skeleton className="h-24 w-full rounded-xl" /></div>;
    }

    if (!post) {
        return <Card className="m-4 max-w-2xl mx-auto"><CardContent className="p-8 text-center"><p className="font-bold">Post not found</p><Button asChild variant="link"><Link href="/home">Return Home</Link></Button></CardContent></Card>;
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-4 pb-24 max-w-2xl mx-auto">
            <Button variant="ghost" onClick={() => router.back()} className="mb-2"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            <PostCard post={post} onUpdatePost={(p) => setPost(p)} onDeletePost={() => router.push('/home')} />
            
            <div className="pt-6 border-t">
                <h3 className="text-lg font-bold">Conversation ({post.stats?.comments || 0})</h3>
                <div className="flex items-start gap-3 pt-4 mb-8">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={postType === 'curia' ? undefined : (user?.photoURL ?? undefined)}/>
                        <AvatarFallback>{postType === 'curia' ? nickname.charAt(0) : (user?.displayName?.charAt(0) ?? 'U')}</AvatarFallback>
                    </Avatar>
                    <div className="relative flex-1">
                        <Textarea placeholder={postType === 'curia' ? "Speak anonymously..." : "Write a comment..."} className="bg-card pr-12 rounded-2xl min-h-[50px] font-medium" value={newComment} onChange={(e) => setNewComment(e.target.value)} minRows={1}/>
                        <Button size="icon" className="absolute right-2 top-2 h-7 w-7 rounded-xl" onClick={handleAddComment} disabled={isSubmitting || !newComment.trim()}><Send className="h-4 w-4" /></Button>
                    </div>
                </div>

                <div className="space-y-6">
                    {commentsTree.map(comment => (
                        <CommentCard 
                            key={comment.id} 
                            comment={comment} 
                            onCommentUpdate={handleCommentUpdate} 
                            onCommentDelete={handleCommentDelete} 
                        />
                    ))}
                    {commentsTree.length === 0 && <p className="text-muted-foreground text-center py-12 italic">No comments yet.</p>}
                </div>
            </div>
        </div>
    )
}

export default function PostPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></div>}>
            <PostDetailContent />
        </Suspense>
    );
}
