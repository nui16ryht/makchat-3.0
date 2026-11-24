
"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Link, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Post } from './post-card';
import { Conversation } from '@/app/(main)/messages/page';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';

interface SharePostDialogProps {
  post: Post | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: Conversation[];
  onShareToChat: (targets: { type: 'dm'; id: string }[]) => void;
}

type ShareStep = 'initial' | 'select_chat';

export function SharePostDialog({
  post,
  open,
  onOpenChange,
  conversations,
  onShareToChat,
}: SharePostDialogProps) {
  const [step, setStep] = useState<ShareStep>('initial');
  const [selected, setSelected] = useState<string[]>([]);
  const [user] = useAuthState(auth);
  const { toast } = useToast();

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep('initial');
      setSelected([]);
    }, 300);
  };

  const handleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleShareClick = () => {
    const targets = selected.map((s) => {
      const [type, id] = s.split(':::');
      return { type, id } as { type: 'dm'; id: string };
    });
    onShareToChat(targets);
    handleClose();
  };
  
  const handleCopyToClipboard = () => {
    if (!post) return;
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
    toast({
      title: "Link Copied!",
      description: "The post link has been copied to your clipboard.",
    });
    handleClose();
  }

  const getOtherUser = (convo: Conversation) => {
    if (!user) return { name: '', avatar: '' };
    const otherUserId = convo.users.find((uid) => uid !== user.uid) || '';
    return {
      name: convo.userNames[otherUserId] || 'Unknown User',
      avatar: convo.userAvatars[otherUserId] || `https://picsum.photos/seed/${otherUserId}/100`,
    };
  };

  const renderInitialStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>Share Post</DialogTitle>
        <DialogDescription>Share this post with your friends.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-4 py-4">
        <Button variant="outline" className="justify-start p-4 h-auto" onClick={() => setStep('select_chat')}>
          <Share2 className="mr-3" />
          <div>
            <p className="font-semibold text-base">Share to Chat</p>
            <p className="font-normal text-sm text-muted-foreground">Send to a friend or a group.</p>
          </div>
        </Button>
         <Button variant="outline" className="justify-start p-4 h-auto" onClick={handleCopyToClipboard}>
          <Link className="mr-3" />
           <div>
            <p className="font-semibold text-base">Copy Link</p>
            <p className="font-normal text-sm text-muted-foreground">Copy a link to the post.</p>
          </div>
        </Button>
      </div>
    </>
  );

  const renderSelectChatStep = () => (
    <>
      <DialogHeader>
        <DialogTitle>Select Chats</DialogTitle>
        <DialogDescription>Choose who to share this post with.</DialogDescription>
      </DialogHeader>
      <ScrollArea className="max-h-80 -mx-6">
        <div className="px-6 space-y-2">
          {conversations.length > 0 && <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><MessageSquare size={16}/> Direct Messages</p>}
          {conversations.map((convo) => {
            const otherUser = getOtherUser(convo);
            const key = `dm:::${convo.id}`;
            return (
              <div
                key={key}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted',
                  selected.includes(key) && 'bg-muted'
                )}
                onClick={() => handleSelect(key)}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={otherUser.avatar} data-ai-hint="person face" />
                  <AvatarFallback>{otherUser.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <p className="font-semibold">{otherUser.name}</p>
              </div>
            );
          })}
        </div>
      </ScrollArea>
       <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => setStep('initial')}>Back</Button>
          <Button onClick={handleShareClick} disabled={selected.length === 0}>Share</Button>
        </div>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        {step === 'initial' && renderInitialStep()}
        {step === 'select_chat' && renderSelectChatStep()}
      </DialogContent>
    </Dialog>
  );
}
