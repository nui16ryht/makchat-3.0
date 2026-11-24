
"use client";

import React, { useEffect, useState } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, PlusCircle, User, Settings, LogOut, UserPlus, Bell, TrendingUp, Hash } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '../ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import Link from 'next/link';
import { CreatePost } from './create-post';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, signOut, db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { PwaInstallButton } from './pwa-install-button';

export function AppHeader() {
  const { toast } = useToast();
  const router = useRouter();
  const [user] = useAuthState(auth);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isCreatePostOpen, setIsCreatePostOpen] = React.useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [trendingHashtags, setTrendingHashtags] = useState<string[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  useEffect(() => {
    if (!user) return;
    
    const notifQuery = query(collection(db, "users", user.uid, "notifications"), where("read", "==", false));
    const unsubNotifs = onSnapshot(notifQuery, (snapshot) => {
        setHasUnreadNotifications(!snapshot.empty);
    });

    const postsQuery = query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(50));
    const unsubPosts = onSnapshot(postsQuery, (snapshot) => {
        const hashtags: { [key: string]: number } = {};
        snapshot.forEach(doc => {
            const content = doc.data().content || "";
            const matches = content.match(/#(\w+)/g);
            if (matches) {
                matches.forEach((tag: string) => { hashtags[tag] = (hashtags[tag] || 0) + 1; });
            }
        });
        const sortedTags = Object.entries(hashtags).sort((a, b) => b[1] - a[1]).map(entry => entry[0]).slice(0, 6);
        setTrendingHashtags(sortedTags);
    });

    return () => { unsubNotifs(); unsubPosts(); };
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    toast({ title: "Logged Out" });
    router.push('/');
  }

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      setIsSearchOpen(false);
      router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  }

  const handleTrendingClick = (tag: string) => {
      const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
      setSearchTerm(cleanTag);
      setIsSearchOpen(false);
      router.push(`/search?q=${encodeURIComponent(cleanTag)}`);
  }

  const userUsername = user?.email?.split('@')[0] ?? 'guest';

  if (!isMounted) return <div className="h-16 border-b" />;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <SidebarTrigger className="md:hidden" />
      <PwaInstallButton />
      <div className="flex-1 flex items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <PopoverTrigger asChild>
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="search" placeholder="Search MakChat..." className="w-full rounded-full bg-secondary pl-10 focus-visible:ring-primary h-10" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); if (!isSearchOpen) setIsSearchOpen(true); }} onKeyDown={handleSearch} onFocus={() => setIsSearchOpen(true)} />
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80 p-0 overflow-hidden" align="start" sideOffset={8} onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="flex flex-col">
                    <div className="px-4 py-3 bg-muted/30 border-b flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trending on Campus</span></div>
                    {trendingHashtags.length > 0 ? (
                        <div className="p-1">
                            {trendingHashtags.map((tag) => (
                                <button key={tag} onClick={() => handleTrendingClick(tag)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary rounded-md transition-colors group text-left">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20"><Hash className="h-4 w-4 text-primary" /></div>
                                    <div className="flex-1 overflow-hidden"><p className="text-sm font-semibold truncate">{tag}</p><p className="text-[10px] text-muted-foreground">Trending Topic</p></div>
                                </button>
                            ))}
                        </div>
                    ) : (<div className="p-8 text-center text-muted-foreground"><p className="text-sm">Type to search for students or posts.</p></div>)}
                </div>
            </PopoverContent>
          </Popover>
        </div>
        <Button asChild variant="ghost" size="icon" className="text-muted-foreground"><Link href="/follow-suggestions"><UserPlus className="h-4 w-4" /><span className="sr-only">Follow Suggestions</span></Link></Button>
        <Button asChild variant="ghost" size="icon" className="text-muted-foreground relative"><Link href="/notifications"><Bell className="h-4 w-4" /><span className="sr-only">Notifications</span>{hasUnreadNotifications && <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-primary" />}</Link></Button>
      </div>
      <div className="flex items-center gap-2">
        <Dialog open={isCreatePostOpen} onOpenChange={setIsCreatePostOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1 rounded-full max-sm:hidden"><PlusCircle className="h-4 w-4" /><span>Create Post</span></Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Create a new post</DialogTitle><DialogDescription>Share what's on your mind with the community.</DialogDescription></DialogHeader><CreatePost onCreatePost={() => { toast({ title: "Post Created!" }); setIsCreatePostOpen(false); }} /></DialogContent>
        </Dialog>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Avatar className="h-9 w-9 cursor-pointer">
                    <AvatarImage src={user?.photoURL ?? `https://picsum.photos/seed/${user?.uid || '1'}/100`} />
                    <AvatarFallback>{user?.displayName?.charAt(0) ?? 'U'}</AvatarFallback>
                </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>@{userUsername}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/profile/me"><User className="mr-2 h-4 w-4" /><span>Profile</span></Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/settings"><Settings className="mr-2 h-4 w-4" /><span>Settings</span></Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" /><span>Logout</span></DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
