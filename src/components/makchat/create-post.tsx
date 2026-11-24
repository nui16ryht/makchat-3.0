
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Globe, Image as ImageIcon, X, Video, BarChart2, PlusCircle, Loader2 } from "lucide-react";
import React, { useRef, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { Skeleton } from "../ui/skeleton";
import NextImage from 'next/image';
import Link from 'next/link';
import { CropImageDialog } from "./crop-image-dialog";
import { Input } from "../ui/input";
import { collection, query, where, getDocs, Timestamp, addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";

interface CreatePostProps {
  onCreatePost: (content: string, mediaFile?: File | null, poll?: any) => void;
  isCuria?: boolean;
  nickname?: string;
}

export function CreatePost({ onCreatePost, isCuria = false, nickname }: CreatePostProps) {
  const { toast } = useToast();
  const [user, loading] = useAuthState(auth);
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = React.useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [isCheckingPollLimit, setIsCheckingPollLimit] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [cropSource, setCropSource] = useState<string | null>(null);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePost = async () => {
    if (!user || (!content.trim() && !mediaFile && !showPollBuilder)) {
        toast({
            variant: 'destructive',
            title: "Cannot create an empty post",
            description: "Please add some content, an image, or a poll.",
        });
        return;
    }

    setIsPosting(true);
    let pollData = null;
    if (showPollBuilder) {
        const filteredOptions = pollOptions.filter(o => o.trim() !== "");
        if (filteredOptions.length < 2) {
            toast({ variant: 'destructive', title: "Invalid Poll", description: "At least 2 options are required." });
            setIsPosting(false);
            return;
        }
        pollData = {
            options: filteredOptions.map((text, id) => ({ id, text, votes: [] })),
            totalVotes: 0,
            expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)), // 24 hours
        };
    }

    try {
        // Handle Mentions Logic
        const mentions = Array.from(content.matchAll(/@([a-z0-9_.]+)/gi)).map(m => m[1].toLowerCase());
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        const userData = userDocSnap.data();

        // Pass to parent handler which creates the post
        onCreatePost(content, mediaFile, pollData);

        // After post created (optimistic UI), trigger notifications for mentions
        // We'll delay slightly to let the post create if needed, or rely on onCreatePost being sync
        if (mentions.length > 0 && !isCuria) {
            for (const username of Array.from(new Set(mentions))) {
                if (username === userData?.username) continue;
                const uq = query(collection(db, 'users'), where('username', '==', username));
                const usnap = await getDocs(uq);
                if (!usnap.empty) {
                    const targetUid = usnap.docs[0].id;
                    await addDoc(collection(db, 'users', targetUid, 'notifications'), {
                        type: 'mention',
                        actor: { uid: user.uid, name: userData?.name, username: userData?.username, avatar: userData?.avatar },
                        entity: { type: 'post', id: 'new', content: content.substring(0, 50) },
                        read: false,
                        timestamp: serverTimestamp()
                    });
                    
                    fetch('/api/notify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          targetUid,
                          title: `@${userData?.username} mentioned you`,
                          body: content.substring(0, 50),
                          clickAction: `/home`,
                          type: 'mention'
                        })
                    }).catch(() => {});
                }
            }
        }

        setContent("");
        setMediaFile(null);
        setMediaPreview(null);
        setMediaType(null);
        setShowPollBuilder(false);
        setPollOptions(["", ""]);
    } finally {
        setIsPosting(false);
    }
  };

  const handlePollToggle = async () => {
    if (showPollBuilder) {
        setShowPollBuilder(false);
        return;
    }

    if (!user) return;
    setIsCheckingPollLimit(true);
    
    try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const q = query(
            collection(db, "posts"),
            where("user.uid", "==", user.uid),
            where("timestamp", ">=", Timestamp.fromDate(weekAgo))
        );
        
        const snapshot = await getDocs(q);
        const hasPollThisWeek = snapshot.docs.some(doc => !!doc.data().poll);
        
        if (hasPollThisWeek && !isCuria) {
             toast({ 
                 variant: 'destructive', 
                 title: "Weekly Limit", 
                 description: "You've already created a poll this week. Only 1 poll is allowed every 7 days on the main feed." 
             });
             return;
        }

        setShowPollBuilder(true);
        setMediaFile(null);
        setMediaPreview(null);
        setMediaType(null);
    } catch (error) {
        console.error("Poll limit check error:", error);
    } finally {
        setIsCheckingPollLimit(false);
    }
  };

  const addPollOption = () => {
      if (pollOptions.length < 5) setPollOptions([...pollOptions, ""]);
  };

  const removePollOption = (idx: number) => {
      if (pollOptions.length > 2) setPollOptions(pollOptions.filter((_, i) => i !== idx));
  };

  const updatePollOption = (idx: number, val: string) => {
      const newOpts = [...pollOptions];
      newOpts[idx] = val;
      setPollOptions(newOpts);
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setMediaType('image');
        const reader = new FileReader();
        reader.onloadend = () => {
          setCropSource(reader.result as string);
          setIsCropDialogOpen(true);
        };
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
        setMediaType('video');
        setMediaFile(file);
        setMediaPreview(URL.createObjectURL(file));
      }
      setShowPollBuilder(false);
    }
  };

  const handleSaveCroppedImage = (croppedImageBlob: Blob | null) => {
    setIsCropDialogOpen(false);
    if (croppedImageBlob) {
        const file = new File([croppedImageBlob], "post_image.jpeg", { type: "image/jpeg" });
        setMediaFile(file);
        setMediaPreview(URL.createObjectURL(file));
    }
    setCropSource(null);
  }

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
  }

  if (!mounted || loading) return <Card className="shadow-none border-t-0 rounded-t-none"><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>;
  if (!user || user.isAnonymous) return null;

  return (
    <>
    {cropSource && mediaType === 'image' && (
        <CropImageDialog 
            imageSrc={cropSource}
            open={isCropDialogOpen}
            onOpenChange={setIsCropDialogOpen}
            onSave={handleSaveCroppedImage}
        />
    )}
    <Card className="shadow-none border-t-0 rounded-t-none">
      <CardContent className="p-4">
        <div className="flex gap-4">
          <Link href={isCuria ? "#" : "/profile/me"}>
            <Avatar>
              <AvatarImage src={isCuria ? undefined : (user.photoURL ?? "")} />
              <AvatarFallback>{isCuria ? nickname?.charAt(0) : (user.displayName?.charAt(0) ?? 'U')}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="w-full">
            <Textarea
              placeholder={isCuria ? "What's the anonymous talk tonight?" : "What's on your mind?"}
              className="w-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-secondary resize-none min-h-[80px] p-4 rounded-2xl font-medium"
              minRows={2}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {mediaPreview && (
                <div className="mt-4 relative">
                    <div className="relative w-full overflow-hidden rounded-lg border">
                        {mediaType === 'image' ? (
                           <div className="aspect-video w-full relative">
                            <NextImage src={mediaPreview} alt="Preview" fill className="object-contain" />
                           </div>
                        ) : (
                            <video src={mediaPreview} controls className="w-full h-full object-contain" />
                        )}
                    </div>
                    <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={removeMedia}><X className="h-4 w-4" /></Button>
                </div>
            )}
            
            {showPollBuilder && (
                <div className="mt-4 p-4 border rounded-xl space-y-3 bg-muted/30">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Poll Attachment</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowPollBuilder(false)}><X className="h-4 w-4"/></Button>
                    </div>
                    {pollOptions.map((opt, i) => (
                        <div key={i} className="flex gap-2">
                            <Input 
                                placeholder={`Option ${i+1}`} 
                                value={opt} 
                                onChange={(e) => updatePollOption(i, e.target.value)}
                                className="h-9 bg-card border-none"
                            />
                            {pollOptions.length > 2 && (
                                <Button variant="ghost" size="icon" onClick={() => removePollOption(i)}><X className="h-3 w-3"/></Button>
                            )}
                        </div>
                    ))}
                    {pollOptions.length < 5 && (
                        <Button variant="outline" size="sm" className="w-full h-8 text-xs border-dashed" onClick={addPollOption}><PlusCircle className="mr-2 h-3 w-3"/>Add Option</Button>
                    )}
                </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center p-4 pt-0">
        <div className="flex gap-1">
            <input type="file" accept="image/*" ref={imageInputRef} onChange={handleMediaChange} className="hidden"/>
            <input type="file" accept="video/*" ref={videoInputRef} onChange={handleMediaChange} className="hidden"/>
            <Button variant="ghost" size="icon" onClick={() => imageInputRef.current?.click()}><ImageIcon className="h-5 w-5 text-muted-foreground" /></Button>
            <Button variant="ghost" size="icon" onClick={() => videoInputRef.current?.click()}><Video className="h-5 w-5 text-muted-foreground" /></Button>
            <Button variant="ghost" size="icon" onClick={() => handlePollToggle()} disabled={isCheckingPollLimit}>
                {isCheckingPollLimit ? <BarChart2 className="h-5 w-5 animate-pulse" /> : <BarChart2 className="h-5 w-5 text-muted-foreground" />}
            </Button>
        </div>
        <Button onClick={handlePost} disabled={(!content.trim() && !mediaFile && !showPollBuilder) || isCheckingPollLimit || isPosting}>
            {isPosting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
            Post
        </Button>
      </CardFooter>
    </Card>
    </>
  );
}
