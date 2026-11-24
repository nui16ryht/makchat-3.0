
"use client";
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MoreVertical, Search, Phone, Send, ArrowLeft, Forward, X, Trash2, Reply, Paperclip, Loader2, Image as ImageIcon, Video, Download, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, storage } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, doc, getDoc, setDoc, Timestamp, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import Link from 'next/link';
import NextImage from 'next/image';
import { CropImageDialog } from '@/components/makchat/crop-image-dialog';
import { formatDistanceToNowStrict } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLongPress } from '@/hooks/use-long-press';


export type ConversationUser = {
    uid: string;
    name: string;
    avatar: string;
    username: string;
    lastSeen: Timestamp;
    online: boolean;
}

export type Conversation = {
    id: string;
    users: string[];
    userNames: { [key: string]: string };
    userAvatars: { [key: string]: string };
    userUsernames?: { [key: string]: string };
    lastMessage: string;
    lastMessageTimestamp: Timestamp;
    unreadCount?: { [key: string]: number };
    lastReadTimestamp?: { [key: string]: Timestamp };
};

type ReplyContext = {
    id: string;
    text: string;
    senderId: string;
};

type Message = {
    id: string;
    senderId: string;
    text: string;
    timestamp: Timestamp;
    replyingTo?: ReplyContext;
    isForwarded?: boolean;
    mediaURL?: string;
    mediaType?: 'image' | 'video';
    type?: 'system';
};

const MediaViewer = ({ src, type, open, onOpenChange }: { src: string | null, type: 'image' | 'video' | null, open: boolean, onOpenChange: (open: boolean) => void }) => {
    if (!src) return null;
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-full h-[90vh] p-2 flex flex-col">
                <DialogHeader className="sr-only">
                    <DialogTitle>Media Viewer</DialogTitle>
                    <DialogDescription>Full screen view of shared media</DialogDescription>
                </DialogHeader>
                <div className="relative flex-1 w-full h-full">
                    {type === 'image' ? (
                        <NextImage src={src} alt="Full screen media" fill className="object-contain" />
                    ) : (
                        <video src={src} controls className="w-full h-full object-contain" />
                    )}
                </div>
                 <DialogFooter className="p-2 sm:justify-end flex-shrink-0">
                    <Button onClick={() => onOpenChange(false)}>Close</Button>
                 </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const ForwardDialog = ({ open, onOpenChange, onForward, conversations, currentUser }: { open: boolean, onOpenChange: (open: boolean) => void, onForward: (targets: {type: 'dm', id: string}[]) => void, conversations: Conversation[], currentUser: any }) => {
    const [selected, setSelected] = useState<string[]>([]);

    const handleSelect = (id: string) => {
        setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
    }

    const handleForwardClick = () => {
        const targets = selected.map(id => ({ type: 'dm', id }) as {type: 'dm', id: string});
        onForward(targets);
    }
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Forward message to...</DialogTitle>
                    <DialogDescription>Select the chats you want to forward this message to.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-64 my-4">
                    <div className="space-y-2 pr-4">
                       {conversations.map(convo => {
                           if (!currentUser) return null;
                           const otherUserId = convo.users.find(uid => uid !== currentUser.uid) || '';
                           const otherUserName = convo.userNames[otherUserId];
                           const otherUserAvatar = convo.userAvatars[otherUserId];
                           return (
                                <div key={convo.id} className={cn("flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted", selected.includes(convo.id) && "bg-muted")} onClick={() => handleSelect(convo.id)}>
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={otherUserAvatar} data-ai-hint="person face"/>
                                        <AvatarFallback>{otherUserName?.substring(0,2)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold">{otherUserName}</p>
                                    </div>
                                </div>
                           )
                       })}
                    </div>
                </ScrollArea>
                 <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleForwardClick} disabled={selected.length === 0}>Forward</Button>
                 </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const ConversationList = ({ 
    conversations, 
    activeConversationId, 
    onSelect, 
    loading, 
    currentUser,
    getOtherUser,
    otherUsers
}: {
    conversations: Conversation[],
    activeConversationId: string | null,
    onSelect: (convo: Conversation) => void,
    loading: boolean,
    currentUser: any,
    getOtherUser: (convo: Conversation) => { name: string, avatar: string, uid: string, username: string },
    otherUsers: { [key: string]: ConversationUser }
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    
    const filteredConversations = conversations.filter(c => {
       if (!currentUser) return false;
       const otherUser = getOtherUser(c);
       return otherUser.name.toLowerCase().includes(searchTerm.toLowerCase())
    });

    const truncateText = (text: string, maxLen: number) => {
        if (!text) return "";
        return text.length > maxLen ? text.substring(0, maxLen) + "..." : text;
    };

    return (
        <div className="w-full sm:w-[320px] sm:border-r flex flex-col h-full bg-background min-h-0">
            <div className="p-4 border-b">
                <h2 className="text-xl font-bold font-headline">Messages</h2>
                <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search messages..." 
                        className="pl-10 h-10 rounded-full bg-secondary border-none" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <ScrollArea className="flex-1">
                {loading ? (
                    <div className="p-4 space-y-4">
                        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                ) : filteredConversations.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm italic">
                        No conversations yet.
                    </div>
                ) : filteredConversations.map(convo => {
                     const otherUser = getOtherUser(convo);
                     const unreadCount = convo.unreadCount?.[currentUser.uid] ?? 0;
                     const otherUserData = otherUsers[otherUser.uid];
                     const isActive = activeConversationId === convo.id;
                     
                     return (
                        <div key={convo.id} 
                             className={cn(
                                "flex items-start gap-4 p-4 hover:bg-muted cursor-pointer border-b group transition-colors",
                                isActive && "bg-muted"
                             )}
                             onClick={() => onSelect(convo)}>
                            <Link href={`/profile/${otherUser.username}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
                                <div className="relative">
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage src={otherUser.avatar} />
                                        <AvatarFallback>{otherUser.name.substring(0,2)}</AvatarFallback>
                                    </Avatar>
                                    {otherUserData?.online && (
                                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full"/>
                                    )}
                                </div>
                            </Link>
                            <div className="flex-1 overflow-hidden text-ellipsis">
                                <div className="flex justify-between items-center mb-0.5">
                                    <div className="flex items-center gap-2 truncate">
                                        {unreadCount > 0 && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                                        <p className={cn("font-semibold truncate max-w-[120px]", unreadCount > 0 && "text-foreground")}>{otherUser.name}</p>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                        {convo.lastMessageTimestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div className="flex justify-between items-start gap-2 overflow-hidden">
                                    <p className={cn("text-sm break-words", unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>
                                        {truncateText(convo.lastMessage || "No messages yet", 45)}
                                    </p>
                                    {unreadCount > 0 && (
                                        <Badge className="h-5 min-w-[20px] px-1 justify-center rounded-full bg-primary text-primary-foreground text-[10px] shrink-0">
                                            {unreadCount}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </ScrollArea>
        </div>
    );
};

const ChatView = ({ 
    conversation, 
    messages, 
    loadingMessages, 
    currentUser, 
    onSendMessage,
    isSending,
    onBack,
    getOtherUser,
    onForwardMessage,
    onDeleteMessage,
    otherUserData
}: {
    conversation: Conversation,
    messages: Message[],
    loadingMessages: boolean,
    currentUser: any,
    onSendMessage: (msg: string, replyTo?: ReplyContext, mediaFile?: File | null, mediaType?: 'image' | 'video' | null) => void,
    isSending: boolean,
    onBack: () => void,
    getOtherUser: (convo: Conversation) => { name: string, avatar: string, uid: string, username: string },
    onForwardMessage: (message: Message) => void,
    onDeleteMessage: (messageId: string) => void,
    otherUserData: ConversationUser | undefined
}) => {
    const { toast } = useToast();
    const [currentMessage, setCurrentMessage] = useState("");
    const [replyContext, setReplyContext] = useState<ReplyContext | null>(null);

    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
    
    const [viewingMedia, setViewingMedia] = useState<{src: string, type: 'image' | 'video'} | null>(null);

    const [cropSource, setCropSource] = useState<string | null>(null);
    const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);

    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const scrollAreaViewportRef = useRef<HTMLDivElement>(null);
    const unreadMessageRef = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();
    const otherUser = getOtherUser(conversation);

    const [lastReadTimestamp, setLastReadTimestamp] = useState<number | null>(null);
    const [initialLoad, setInitialLoad] = useState(true);

    useEffect(() => {
      setLastReadTimestamp(conversation.lastReadTimestamp?.[currentUser.uid]?.toMillis() ?? 0);
      setInitialLoad(false);
    }, [conversation, currentUser.uid]);

    const firstUnreadIndex = lastReadTimestamp !== null && !initialLoad
      ? messages.findIndex(msg => msg.timestamp && msg.timestamp.toMillis() > lastReadTimestamp && msg.senderId !== currentUser.uid)
      : -1;

    useEffect(() => {
        if (loadingMessages || initialLoad || !scrollAreaViewportRef.current) {
            return;
        }

        const timer = setTimeout(() => {
            if (firstUnreadIndex !== -1 && unreadMessageRef.current) {
                unreadMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                scrollAreaViewportRef.current?.scrollTo({ top: scrollAreaViewportRef.current.scrollHeight, behavior: 'smooth' });
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [messages, loadingMessages, firstUnreadIndex, initialLoad]);


    const handleSendMessageClick = () => {
        if (!currentMessage.trim() && !mediaFile) return;
        onSendMessage(currentMessage, replyContext ?? undefined, mediaFile, mediaType);
        setCurrentMessage("");
        setReplyContext(null);
        removeMedia();
    }
    
    const handleFeatureNotImplemented = (feature: string) => {
        toast({
            title: "Feature Coming Soon",
            description: `The ${feature} feature is under construction.`,
        });
    }

    const handleMediaInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
            } else {
                toast({ variant: 'destructive', title: 'Unsupported File', description: 'Please select an image or a video.'});
            }
        }
    };
    
    const handleSaveCroppedImage = (croppedImageBlob: Blob | null) => {
        setIsCropDialogOpen(false);
        if (croppedImageBlob) {
            const file = new File([croppedImageBlob], "chat_image.jpeg", { type: "image/jpeg" });
            setMediaFile(file);
            setMediaPreview(URL.createObjectURL(file));
        }
        setCropSource(null);
    }

    const removeMedia = () => {
        setMediaFile(null);
        setMediaPreview(null);
        setMediaType(null);
        if (imageInputRef.current) {
            imageInputRef.current.value = "";
        }
        if (videoInputRef.current) {
            videoInputRef.current.value = "";
        }
    };
    
    const formatLastSeen = (timestamp: Timestamp | undefined) => {
        if (!timestamp) return null;
        return `last seen ${formatDistanceToNowStrict(timestamp.toDate())} ago`;
    }

    const onlineStatus = otherUserData?.online
      ? 'Online'
      : formatLastSeen(otherUserData?.lastSeen);
      
    const MessageItem = React.memo(({ msg }: { msg: Message }) => {
        const [menuOpen, setMenuOpen] = useState(false);

        const longPressEventHandlers = useLongPress({
            onLongPress: () => setMenuOpen(true),
        });

        const imageClickHandlers = useLongPress({
            onLongPress: () => setMenuOpen(true),
            onClick: () => {
                 if (msg.mediaType === 'image') {
                    setViewingMedia({ src: msg.mediaURL!, type: 'image' });
                }
            }
        });

        const repliedMessageSenderName = (msg: Message) => {
            if (!msg.replyingTo) return '';
            if (msg.replyingTo.senderId === currentUser.uid) return 'You';
            return otherUser.name;
        }

        const handleDownload = async (e: React.MouseEvent) => {
            e.stopPropagation();
            if (!msg.mediaURL) return;

            try {
                const response = await fetch(msg.mediaURL);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                const extension = msg.mediaType === 'video' ? 'mp4' : 'jpg';
                link.download = `makchat-msg-${msg.id}.${extension}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                toast({ title: "Download Started" });
            } catch (error) {
                console.error("Download error:", error);
                toast({ variant: "destructive", title: "Download Failed" });
            }
        };

        if (msg.type === 'system') {
            return (
               <div className="text-center my-2">
                   <p className="text-xs text-muted-foreground bg-secondary inline-block px-2 py-1 rounded-full">{msg.text}</p>
               </div>
           )
       }

        return (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <div className={`group relative flex items-start gap-3 ${msg.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}>
                    {msg.senderId !== currentUser?.uid && (
                        <Link href={`/profile/${otherUser.username}`}>
                            <Avatar className="h-8 w-8"><AvatarImage src={otherUser.avatar} /><AvatarFallback>{otherUser.name.substring(0,2)}</AvatarFallback></Avatar>
                        </Link>
                    )}
                    <DropdownMenuTrigger asChild>
                        <div
                            className={cn(
                                "p-3 rounded-md max-w-[70%] space-y-2 select-none touch-manipulation",
                                msg.senderId === currentUser?.uid ? 'bg-primary text-primary-foreground' : 'bg-card'
                            )}
                             {...longPressEventHandlers}
                        >
                            {msg.isForwarded && <p className="text-xs opacity-70 mb-1 flex items-center gap-1"><Forward size={12} /> Forwarded</p>}
                            {msg.replyingTo && (
                                <div className="p-2 rounded-md bg-black/10 mb-2 border-l-2 border-white/50">
                                    <p className="text-xs font-semibold">{repliedMessageSenderName(msg)}</p>
                                    <p className="text-xs opacity-80 line-clamp-2">{msg.replyingTo.text}</p>
                                </div>
                            )}
                            
                            {msg.mediaURL && msg.mediaType && (
                                <div className="relative max-w-xs rounded-md overflow-hidden">
                                    {msg.mediaType === 'image' ? (
                                        <div className="relative w-full cursor-pointer" {...imageClickHandlers}>
                                          <NextImage 
                                              src={msg.mediaURL} 
                                              alt="Sent media" 
                                              width={0}
                                              height={0}
                                              sizes="100vw"
                                              style={{ width: '100%', height: 'auto' }}
                                              className="object-contain rounded-md"
                                          />
                                        </div>
                                    ) : (
                                        <video 
                                            src={msg.mediaURL} 
                                            controls 
                                            playsInline 
                                            className="w-full h-auto rounded-md"
                                            onClick={(e) => e.stopPropagation()} 
                                        />
                                    )}
                                </div>
                            )}

                            {msg.text && (
                                <p className="break-words text-sm sm:text-base">{msg.text}</p>
                            )}
                            <p className={`text-xs mt-1 ${msg.senderId === currentUser?.uid ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                    </DropdownMenuTrigger>
                    {msg.senderId === currentUser?.uid && (
                       <Link href={`/profile/me`}>
                           <Avatar className="h-8 w-8"><AvatarImage src={currentUser.photoURL} /><AvatarFallback>{currentUser.displayName?.substring(0,2)}</AvatarFallback></Avatar>
                       </Link>
                    )}
                </div>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setReplyContext({ id: msg.id, text: msg.text || 'Media', senderId: msg.senderId })}>
                        <Reply className="mr-2 h-4 w-4" /> Reply
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onForwardMessage(msg)}>
                        <Forward className="mr-2 h-4 w-4" /> Forward
                    </DropdownMenuItem>
                    {msg.mediaURL && (
                        <DropdownMenuItem onClick={handleDownload}>
                            <Download className="mr-2 h-4 w-4" /> Download
                        </DropdownMenuItem>
                    )}
                    {msg.senderId === currentUser?.uid && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete for Everyone
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Message?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to delete this message for everyone? This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDeleteMessage(msg.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    });
    MessageItem.displayName = "MessageItem";


    return (
         <>
         {cropSource && (
            <CropImageDialog 
                imageSrc={cropSource}
                open={isCropDialogOpen}
                onOpenChange={setIsCropDialogOpen}
                onSave={handleSaveCroppedImage}
            />
         )}
         <MediaViewer 
            src={viewingMedia?.src ?? null}
            type={viewingMedia?.type ?? null} 
            open={!!viewingMedia} 
            onOpenChange={(open) => !open && setViewingMedia(null)}
          />
         <div className="flex-1 flex flex-col h-full bg-muted/5 min-h-0">
            <div className="flex-shrink-0 flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    {isMobile && (
                        <Button variant="ghost" size="icon" className="-ml-2" onClick={onBack}>
                            <ArrowLeft />
                        </Button>
                    )}
                    <Link href={`/profile/${otherUser.username}`}>
                        <div className="relative">
                            <Avatar>
                                <AvatarImage src={otherUser.avatar} />
                                <AvatarFallback>{otherUser.name.substring(0,2)}</AvatarFallback>
                            </Avatar>
                            {otherUserData?.online && (
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full"/>
                            )}
                        </div>
                    </Link>
                    <div>
                        <Link href={`/profile/${otherUser.username}`}>
                            <p className="font-semibold hover:underline text-sm sm:text-base">{otherUser.name}</p>
                        </Link>
                        <p className={cn("text-[10px] sm:text-xs", otherUserData?.online ? "text-green-500" : "text-muted-foreground")}>
                            {onlineStatus}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleFeatureNotImplemented("Voice Call")}><Phone className="h-5 w-5 text-muted-foreground"/></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleFeatureNotImplemented("More Options")}><MoreVertical className="h-5 w-5 text-muted-foreground"/></Button>
                </div>
            </div>
            <ScrollArea className="flex-1 p-4" viewportRef={scrollAreaViewportRef}>
                <div className="space-y-2">
                    {loadingMessages ? (
                        <div className="p-4 space-y-4">
                            <Skeleton className="h-12 w-2/3" />
                            <Skeleton className="h-16 w-3/4 ml-auto" />
                            <Skeleton className="h-12 w-1/2" />
                        </div>
                    ) : messages.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20 text-center px-4">
                            <MessageCircle className="h-12 w-12 mb-4 opacity-20" />
                            <p className="text-sm">This is the start of your conversation with <b>{otherUser.name}</b>.</p>
                            <p className="text-xs mt-1">Say hello!</p>
                        </div>
                    ) : messages.map((msg, index) => (
                        <React.Fragment key={msg.id}>
                          {index === firstUnreadIndex && (
                            <div
                              ref={unreadMessageRef}
                              className="relative my-4 flex items-center"
                            >
                              <div className="flex-grow border-t border-destructive"></div>
                              <span className="flex-shrink mx-2 text-xs text-destructive font-semibold">
                                New messages
                              </span>
                              <div className="flex-grow border-t border-destructive"></div>
                            </div>
                          )}
                          <MessageItem msg={msg} />
                        </React.Fragment>
                      ))}
                </div>
            </ScrollArea>
            <div className="flex-shrink-0 p-4 border-t bg-card flex flex-col gap-2 sticky bottom-0">
                 {mediaPreview && (
                    <div className="relative w-24 h-24 rounded-md overflow-hidden border">
                        {mediaType === 'image' ? (
                           <NextImage src={mediaPreview} alt="Media preview" fill className="object-cover" />
                        ) : (
                           <video src={mediaPreview} className="w-full h-full object-cover" />
                        )}
                        <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full" onClick={removeMedia}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                {replyContext && (
                    <div className="w-full bg-muted p-2 rounded-md relative border-l-4 border-primary">
                        <p className="text-sm font-semibold">Replying to {replyContext.senderId === currentUser.uid ? 'Yourself' : otherUser.name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">{replyContext.text}</p>
                        <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setReplyContext(null)}>
                            <X size={16} />
                        </Button>
                    </div>
                )}
                <form onSubmit={(e) => { e.preventDefault(); handleSendMessageClick(); }} className="relative w-full flex items-center gap-2">
                    <input type="file" accept="image/*" ref={imageInputRef} onChange={handleMediaInputChange} className="hidden" />
                    <input type="file" accept="video/*" ref={videoInputRef} onChange={handleMediaInputChange} className="hidden" />
                    
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" type="button" className="text-muted-foreground"><Paperclip /></Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" side="top">
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} className="flex-1">
                                    <ImageIcon className="mr-2 h-4 w-4"/> Image
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => videoInputRef.current?.click()} className="flex-1">
                                    <Video className="mr-2 h-4 w-4"/> Video
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Input 
                        placeholder="Type a message..." 
                        className="pr-12 h-11 rounded-full bg-secondary border-none" 
                        value={currentMessage}
                        onChange={(e) => setCurrentMessage(e.target.value)}
                        disabled={!currentUser}
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                        <Button type="submit" size="icon" className="h-9 w-9 rounded-full" disabled={!currentUser || isSending || (!currentMessage.trim() && !mediaFile)}>
                            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                </form>
            </div>
         </div>
         </>
    );
};


export default function MessagesPage() {
    const { toast } = useToast();
    const [user, loadingAuth] = useAuthState(auth);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingConversations, setLoadingConversations] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const isMobile = useIsMobile();
    const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [otherUsersData, setOtherUsersData] = useState<{[key: string]: ConversationUser}>({});
    
    // Memoized active conversation object from the stable ID
    const activeConversation = useMemo(() => {
        return conversations.find(c => c.id === activeConvoId) || null;
    }, [conversations, activeConvoId]);

    // Fetch user's conversations
    useEffect(() => {
        if (!user) {
            setConversations([]);
            setLoadingConversations(false);
            return;
        }
        
        setLoadingConversations(true);
        const q = query(collection(db, "conversations"), where("users", "array-contains", user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const convos: Conversation[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
            convos.sort((a, b) => (b.lastMessageTimestamp?.toMillis() ?? 0) - (a.lastMessageTimestamp?.toMillis() ?? 0));
            setConversations(convos);
            
            // Get all other user IDs to listen for their presence
            const userIds = new Set<string>();
            convos.forEach(c => c.users.forEach(u => u !== user.uid && userIds.add(u)));
            
            if (userIds.size > 0) {
                const presenceQuery = query(collection(db, 'users'), where('uid', 'in', Array.from(userIds).slice(0, 10)));
                const unsubPresence = onSnapshot(presenceQuery, (userSnap) => {
                    const usersData: {[key: string]: ConversationUser} = {};
                    userSnap.forEach(doc => {
                        usersData[doc.id] = doc.data() as ConversationUser;
                    });
                    setOtherUsersData(prev => ({...prev, ...usersData}));
                }, () => {});
                setLoadingConversations(false);
                return () => unsubPresence();
            }
            setLoadingConversations(false);
        }, () => {});

        return () => unsubscribe();
    }, [user]);

    // Handle auto-selecting conversation from URL param or default
    useEffect(() => {
        if (loadingConversations || !user) return;

        const urlParams = new URLSearchParams(window.location.search);
        const convoId = urlParams.get('id');

        if (convoId) {
            if (activeConvoId !== convoId) {
                const existing = conversations.find(c => c.id === convoId);
                if (existing) {
                    setActiveConvoId(convoId);
                } else {
                    const fetchAndSelect = async () => {
                        const convoRef = doc(db, 'conversations', convoId);
                        const docSnap = await getDoc(convoRef);
                        if (docSnap.exists()) {
                            const newConvo = { id: docSnap.id, ...docSnap.data() } as Conversation;
                            setConversations(prev => [newConvo, ...prev.filter(c => c.id !== newConvo.id)]);
                            setActiveConvoId(convoId);
                        }
                    };
                    fetchAndSelect();
                }
            }
            return;
        }

        if (!isMobile && !activeConvoId && conversations.length > 0) {
            setActiveConvoId(conversations[0].id);
        }
    }, [user, conversations, isMobile, loadingConversations, activeConvoId]);


    // Fetch messages for the active conversation
    useEffect(() => {
        if (!activeConvoId || !user) {
            setMessages([]);
            return;
        };
        setLoadingMessages(true);
        const messagesQuery = query(collection(db, "conversations", activeConvoId, "messages"), orderBy("timestamp", "asc"));
        
        const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
            const msgs: Message[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            setMessages(msgs);
            setLoadingMessages(false);
            
            // Only update unread count if it's currently > 0 to avoid unnecessary writes
            const convoRef = doc(db, 'conversations', activeConvoId);
            const unreadKey = `unreadCount.${user.uid}`;
            const lastReadKey = `lastReadTimestamp.${user.uid}`;
            
            getDoc(convoRef).then(snap => {
                if (snap.exists() && (snap.data().unreadCount?.[user.uid] > 0)) {
                    updateDoc(convoRef, { 
                        [unreadKey]: 0,
                        [lastReadKey]: serverTimestamp(),
                    });
                }
            });
        }, () => {});

        return () => unsubscribe();
    }, [activeConvoId, user?.uid]);


    const getOtherUser = useCallback((convo: Conversation | null) => {
        if (!convo || !user) return { name: 'Select a chat', avatar: '', uid: '', username: '' };
        const otherUserId = convo.users.find(uid => uid !== user.uid) || '';
        return {
            uid: otherUserId,
            name: convo.userNames[otherUserId] || 'Unknown User',
            avatar: convo.userAvatars[otherUserId] || `https://picsum.photos/seed/${otherUserId}/100`,
            username: convo.userUsernames?.[otherUserId] || ''
        }
    }, [user?.uid]);

    const handleSendMessage = async (messageText: string, replyTo?: ReplyContext, mediaFile?: File | null, mediaType?: 'image' | 'video' | null) => {
        if ((!messageText.trim() && !mediaFile) || !user || !activeConversation || isSending) return;
        
        setIsSending(true);
        
        try {
            const batch = writeBatch(db);

            const messageData: any = {
                senderId: user.uid,
                text: messageText,
                timestamp: serverTimestamp()
            };

            if (replyTo) messageData.replyingTo = replyTo;
            
            if (mediaFile && mediaType) {
                const storageRef = ref(storage, `messages/${activeConversation.id}/${Date.now()}_${mediaFile.name}`);
                const snapshot = await uploadBytes(storageRef, mediaFile);
                messageData.mediaURL = await getDownloadURL(snapshot.ref);
                messageData.mediaType = mediaType;
            }

            const messagesRef = collection(db, "conversations", activeConversation.id, "messages");
            batch.set(doc(messagesRef), messageData);
            
            const otherUser = getOtherUser(activeConversation);
            const unreadKey = `unreadCount.${otherUser.uid}`;

            const convoRef = doc(db, 'conversations', activeConversation.id);
            const convoSnap = await getDoc(convoRef);
            if(convoSnap.exists()) {
                const currentUnread = convoSnap.data().unreadCount?.[otherUser.uid] ?? 0;
                let lastMessage = messageText;
                if (!lastMessage) {
                    lastMessage = mediaType === 'image' ? 'Sent an image' : 'Sent a video';
                }

                batch.update(convoRef, {
                    lastMessage: lastMessage,
                    lastMessageTimestamp: serverTimestamp(),
                    [unreadKey]: currentUnread + 1,
                });
            }

            const notificationRef = doc(collection(db, 'users', otherUser.uid, 'notifications'));
            batch.set(notificationRef, {
                type: 'message',
                actor: {
                    uid: user.uid,
                    name: user.displayName,
                    username: user.email?.split('@')[0],
                    avatar: user.photoURL
                },
                entity: {
                    type: 'conversation',
                    id: activeConversation.id,
                    content: messageText.substring(0, 50) || (mediaType === 'image' ? 'Image' : 'Video')
                },
                read: false,
                timestamp: serverTimestamp(),
            });

            await batch.commit();

            // Trigger Real-time Push Notification
            fetch('/api/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                targetUid: otherUser.uid,
                title: `Message from @${user.email?.split('@')[0] || 'student'}`,
                body: messageText.substring(0, 50) || (mediaType === 'image' ? 'Sent an image' : 'Sent a video'),
                clickAction: `/messages?id=${activeConversation.id}`,
                type: 'message'
              })
            }).catch(e => console.error("Push Error:", e));

        } catch (error) {
            console.error("Error sending message:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to send message." });
        } finally {
            setIsSending(false);
        }
    }

    const handleForward = async (targets: {type: 'dm', id: string}[]) => {
        if (!forwardMessage || !user) return;
        
        const messageContent: any = {
            senderId: user.uid,
            text: forwardMessage.text,
            isForwarded: true,
            timestamp: serverTimestamp(),
        };

        if (forwardMessage.mediaURL) {
            messageContent.mediaURL = forwardMessage.mediaURL;
            messageContent.mediaType = forwardMessage.mediaType;
        }

        try {
            const batch = writeBatch(db);
            for (const target of targets) {
                 const messagesRef = doc(collection(db, "conversations", target.id, "messages"));
                 batch.set(messagesRef, messageContent);

                 const convoRef = doc(db, 'conversations', target.id);
                 const convoSnap = await getDoc(convoRef);
                 if (convoSnap.exists()) {
                     const otherUserId = convoSnap.data().users.find((uid: string) => uid !== user.uid);
                     const unreadKey = `unreadCount.${otherUserId}`;
                     const currentUnread = convoSnap.data().unreadCount?.[otherUserId] ?? 0;
                     let lastMessage = messageContent.text;
                     if (!lastMessage) {
                         lastMessage = messageContent.mediaType === 'image' ? 'Forwarded an image' : 'Forwarded a video';
                     }
                     batch.update(convoRef, {
                        lastMessage: lastMessage,
                        lastMessageTimestamp: serverTimestamp(),
                        [unreadKey]: currentUnread + 1,
                     });
                     
                     // Trigger Push for each target
                     fetch('/api/notify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          targetUid: otherUserId,
                          title: `Forwarded message from @${user.email?.split('@')[0] || 'student'}`,
                          body: lastMessage,
                          clickAction: `/messages?id=${target.id}`,
                          type: 'message'
                        })
                      }).catch(() => {});
                 }
            }
            await batch.commit();
            toast({ title: 'Message Forwarded', description: `Your message has been sent to ${targets.length} chat(s).`});
        } catch(error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not forward message.'})
            console.error("Error forwarding message:", error);
        } finally {
            setForwardMessage(null);
        }
    }
    
    const handleDeleteMessage = async (messageId: string) => {
        if (!user || !activeConversation) return;
        try {
            await deleteDoc(doc(db, "conversations", activeConversation.id, "messages", messageId));
            toast({ title: 'Message Deleted' });
        } catch (error) {
            console.error("Error deleting message: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not delete message.' });
        }
    };
    
    const handleSelectConversation = (convo: Conversation) => {
        setActiveConvoId(convo.id);
        if(window.location.search) {
             window.history.replaceState({}, '', window.location.pathname);
        }
    }
    
    const renderContent = () => {
        if (isMobile) {
            if (activeConversation) {
                return (
                    <div className="flex-1 flex flex-col h-full w-full min-h-0">
                        <ChatView
                            conversation={activeConversation}
                            messages={messages}
                            loadingMessages={loadingMessages}
                            currentUser={user}
                            onSendMessage={handleSendMessage}
                            isSending={isSending}
                            onBack={() => setActiveConvoId(null)}
                            getOtherUser={getOtherUser}
                            onForwardMessage={setForwardMessage}
                            onDeleteMessage={handleDeleteMessage}
                            otherUserData={otherUsersData[getOtherUser(activeConversation).uid]}
                        />
                    </div>
                );
            }
            return (
                <div className="flex-1 flex flex-col h-full w-full min-h-0">
                    <ConversationList
                        conversations={conversations}
                        activeConversationId={activeConvoId}
                        onSelect={handleSelectConversation}
                        loading={loadingAuth || loadingConversations}
                        currentUser={user}
                        getOtherUser={getOtherUser}
                        otherUsers={otherUsersData}
                    />
                </div>
            );
        }

        // Desktop view
        return (
            <>
                <ConversationList
                    conversations={conversations}
                    activeConversationId={activeConvoId}
                    onSelect={handleSelectConversation}
                    loading={loadingAuth || loadingConversations}
                    currentUser={user}
                    getOtherUser={getOtherUser}
                    otherUsers={otherUsersData}
                />
                <div className="flex-1 flex flex-col h-full min-h-0">
                    {activeConversation ? (
                        <ChatView
                            conversation={activeConversation}
                            messages={messages}
                            loadingMessages={loadingMessages}
                            currentUser={user}
                            onSendMessage={handleSendMessage}
                            isSending={isSending}
                            onBack={() => {}} 
                            getOtherUser={getOtherUser}
                            onForwardMessage={setForwardMessage}
                            onDeleteMessage={handleDeleteMessage}
                            otherUserData={otherUsersData[getOtherUser(activeConversation).uid]}
                        />
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground text-center p-6 bg-muted/5">
                            <div className="max-w-xs space-y-4">
                                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                                    <MessageCircle className="h-8 w-8 text-primary" />
                                </div>
                                <h3 className="text-lg font-semibold text-foreground">Your Messages</h3>
                                <p className="text-sm">Select a conversation from the list to start chatting with your fellow students.</p>
                            </div>
                        </div>
                    )}
                </div>
            </>
        );
    }

    return (
        <>
            <ForwardDialog open={!!forwardMessage} onOpenChange={(open) => !open && setForwardMessage(null)} onForward={handleForward} conversations={conversations} currentUser={user} />
            <div className="flex-1 flex flex-col h-full min-h-0">
                <div className={cn(
                    "flex-1 flex overflow-hidden min-h-0",
                    isMobile ? "" : "border-none shadow-none rounded-none"
                )}>
                    {renderContent()}
                </div>
            </div>
        </>
    )
}
