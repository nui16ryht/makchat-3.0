"use client";

import React from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { type Comment } from './comment-card';

interface ReplyCardProps {
  comment: Comment;
}

const formatTimestamp = (timestamp: Timestamp | null) => {
    if (!timestamp) return 'just now';
    try {
        return `${formatDistanceToNow(timestamp.toDate())} ago`;
    } catch (e) {
        return 'recently';
    }
}

export const ReplyCard: React.FC<ReplyCardProps> = ({ comment }) => {
  const commentUser = comment.user || { name: 'Deleted User', username: 'deleted', avatar: '' };
  
  return (
    <Card className="bg-secondary/50 border-none shadow-none rounded-2xl overflow-hidden">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center gap-2">
            <Link href={`/profile/${commentUser.username}`}>
                <Avatar className="h-8 w-8">
                    <AvatarImage src={commentUser.avatar} alt={commentUser.name} />
                    <AvatarFallback>{commentUser.name.charAt(0)}</AvatarFallback>
                </Avatar>
            </Link>
             <div className="flex flex-col min-w-0">
                <Link href={`/profile/${commentUser.username}`} className="font-semibold text-sm hover:underline truncate">{commentUser.name}</Link>
                <span className="text-[8px] font-bold text-muted-foreground lowercase">replied to a post &middot; {formatTimestamp(comment.timestamp)}</span>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="pl-10">
            <p className="text-sm leading-relaxed break-words">{comment.content}</p>
            <Link href={`/post/${comment.postId}`} className="text-[10px] font-black uppercase tracking-tighter text-primary hover:underline mt-2 inline-block">
                View original post
            </Link>
        </div>
      </CardContent>
    </Card>
  );
};