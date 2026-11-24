
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, arrayUnion, arrayRemove, where, deleteDoc, setDoc } from 'firebase/firestore';
import { Briefcase, Plus, Search, Banknote, Clock, ArrowLeft, Loader2, Filter, User, Send, CheckCircle2, MessageSquare, Sparkles, ChevronDown, Edit3, Trash2, Users } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type GigCategory = 'academic' | 'errands' | 'creative' | 'tech' | 'tutoring' | 'photography' | 'fashion' | 'events' | 'marketing' | 'manual' | 'delivery' | 'research' | 'other';

type Gig = {
    id: string;
    title: string;
    description: string;
    category: GigCategory;
    budget: string;
    deadline?: string;
    user: {
        uid: string;
        name: string;
        username: string;
        avatar: string;
    };
    interested: string[]; // UIDs
    timestamp: any;
};

const CATEGORIES = [
    { label: 'All Gigs', value: 'all' },
    { label: 'Academic Help', value: 'academic' },
    { label: 'Tutoring', value: 'tutoring' },
    { label: 'Campus Errands', value: 'errands' },
    { label: 'Delivery', value: 'delivery' },
    { label: 'Tech & Repair', value: 'tech' },
    { label: 'Creative & Design', value: 'creative' },
    { label: 'Photography/Video', value: 'photography' },
    { label: 'Fashion & Beauty', value: 'fashion' },
    { label: 'Events & Hosting', value: 'events' },
    { label: 'Marketing/Influencing', value: 'marketing' },
    { label: 'Manual/Cleaning', value: 'manual' },
    { label: 'Research/Surveys', value: 'research' },
    { label: 'Other', value: 'other' },
];

export default function GigBoardPage() {
    const [user] = useAuthState(auth);
    const { toast } = useToast();
    const router = useRouter();
    const [gigs, setGigs] = useState<Gig[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
    const [gigToEdit, setGigToEdit] = useState<Gig | null>(null);
    
    // Interests Viewer
    const [isInterestsOpen, setIsInterestsOpen] = useState(false);
    const [viewingGigInterests, setViewingGigInterests] = useState<Gig | null>(null);
    const [interestedUsers, setInterestedUsers] = useState<any[]>([]);
    const [loadingInterests, setLoadingInterests] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState<GigCategory>('errands');
    const [budget, setBudget] = useState('');
    const [deadline, setDeadline] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'gigs'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setGigs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Gig)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setTitle(''); setContent(''); setBudget(''); setDeadline(''); setCategory('errands'); setGigToEdit(null);
    }

    const handleOpenCreate = () => {
        resetForm();
        setIsCreateOpen(true);
    };

    const handleEdit = (gig: Gig) => {
        setGigToEdit(gig);
        setTitle(gig.title);
        setContent(gig.description);
        setCategory(gig.category);
        setBudget(gig.budget);
        setDeadline(gig.deadline || '');
        setIsCreateOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Delete this gig request?")) return;
        try {
            await deleteDoc(doc(db, 'gigs', id));
            toast({ title: "Gig Removed" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Delete Failed" });
        }
    };

    const handlePostGig = async () => {
        if (!user) return;
        if (!title.trim() || !content.trim()) {
            toast({ variant: 'destructive', title: "Details required" });
            return;
        }

        setIsSaving(true);
        try {
            const userSnap = await getDoc(doc(db, 'users', user.uid));
            const userData = userSnap.data();

            const gigData: any = {
                title,
                description: content,
                category,
                budget,
                deadline,
                user: {
                    uid: user.uid,
                    name: userData?.name || user.displayName,
                    username: userData?.username || 'anonymous',
                    avatar: userData?.avatar || user.photoURL
                }
            };

            if (gigToEdit) {
                await updateDoc(doc(db, 'gigs', gigToEdit.id), gigData);
                toast({ title: "Gig Updated!" });
            } else {
                gigData.interested = [];
                gigData.timestamp = serverTimestamp();
                await addDoc(collection(db, 'gigs'), gigData);
                toast({ title: "Gig Posted!", description: "Students can now see your request." });
            }

            resetForm();
            setIsCreateOpen(false);
        } catch (e) {
            toast({ variant: 'destructive', title: "Action Failed" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleInterest = async (gig: Gig) => {
        if (!user) {
            toast({ variant: 'destructive', title: "Log in required" });
            return;
        }
        if (gig.user.uid === user.uid) return;

        setIsActionLoading(gig.id);
        const gigRef = doc(db, 'gigs', gig.id);
        const isInterested = gig.interested?.includes(user.uid);

        try {
            if (isInterested) {
                await updateDoc(gigRef, { interested: arrayRemove(user.uid) });
            } else {
                await updateDoc(gigRef, { interested: arrayUnion(user.uid) });
                
                // Notify Poster
                const userSnap = await getDoc(doc(db, 'users', user.uid));
                const userData = userSnap.data();
                
                await addDoc(collection(db, 'users', gig.user.uid, 'notifications'), {
                    type: 'message', 
                    actor: {
                        uid: user.uid,
                        name: userData?.name || user.displayName,
                        username: userData?.username || 'anonymous',
                        avatar: userData?.avatar || user.photoURL
                    },
                    entity: { type: 'post', id: gig.id, content: `Interested in your gig: ${gig.title}` },
                    read: false,
                    timestamp: serverTimestamp()
                });

                toast({ title: "Interest Shared", description: `We let @${gig.user.username} know you're interested!` });
            }
        } catch (e) {
            toast({ variant: 'destructive', title: "Action Failed" });
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleStartChat = async (targetUser: any, gigTitle: string) => {
        if (!user) return;
        const conversationId = [user.uid, targetUser.uid].sort().join('_');
        const convoRef = doc(db, 'conversations', conversationId);
        
        try {
            const snap = await getDoc(convoRef);
            if (!snap.exists()) {
                const myProfile = await getDoc(doc(db, 'users', user.uid));
                const myData = myProfile.data();
                await setDoc(convoRef, {
                    users: [user.uid, targetUser.uid],
                    userNames: { [user.uid]: myData?.name || user.displayName, [targetUser.uid]: targetUser.name },
                    userAvatars: { [user.uid]: myData?.avatar || user.photoURL, [targetUser.uid]: targetUser.avatar },
                    userUsernames: { [user.uid]: myData?.username || 'student', [targetUser.uid]: targetUser.username },
                    lastMessage: `Regarding Gig: ${gigTitle}`,
                    lastMessageTimestamp: serverTimestamp(),
                });
            }
            router.push(`/messages?id=${conversationId}`);
        } catch (e) {
            toast({ variant: 'destructive', title: "Chat failed" });
        }
    };

    const viewInterests = async (gig: Gig) => {
        setViewingGigInterests(gig);
        setIsInterestsOpen(true);
        setLoadingInterests(true);
        try {
            const users: any[] = [];
            for (const uid of gig.interested || []) {
                const uSnap = await getDoc(doc(db, 'users', uid));
                if (uSnap.exists()) users.push({ uid: uSnap.id, ...uSnap.data() });
            }
            setInterestedUsers(users);
        } catch (e) {} finally {
            setLoadingInterests(false);
        }
    };

    const filteredGigs = gigs.filter(gig => {
        const matchesSearch = gig.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             gig.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCat = activeCategory === 'all' || gig.category === activeCategory;
        return matchesSearch && matchesCat;
    });

    if (loading) {
        return (
            <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
                <Skeleton className="h-12 w-48 mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-3xl" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto pb-24">
            <header className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" asChild className="rounded-full">
                            <Link href="/services"><ArrowLeft className="h-5 w-5" /></Link>
                        </Button>
                        <div>
                            <h1 className="text-4xl font-black font-headline tracking-tighter text-accent flex items-center gap-3">
                                Gig Board <Briefcase className="h-8 w-8" />
                            </h1>
                            <p className="text-muted-foreground font-medium text-sm">Need help or looking for work? Find campus opportunities.</p>
                        </div>
                    </div>
                    {user && (
                        <Button onClick={handleOpenCreate} className="rounded-full h-12 px-8 font-black shadow-lg shadow-accent/20 flex items-center gap-2 bg-accent hover:bg-accent/90 text-white">
                            <Plus className="h-5 w-5" /> Post a Gig
                        </Button>
                    )}
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            placeholder="Search gigs by keyword..." 
                            className="pl-12 h-12 bg-card rounded-2xl border-none shadow-sm" 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="w-full md:w-64">
                        <Select value={activeCategory} onValueChange={setActiveCategory}>
                            <SelectTrigger className="h-12 rounded-2xl bg-card border-none shadow-sm font-bold text-[10px] uppercase tracking-widest px-6">
                                <div className="flex items-center gap-2">
                                    <Filter className="h-3.5 w-3.5 text-accent" />
                                    <SelectValue placeholder="Select Category" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                                {CATEGORIES.map((cat) => (
                                    <SelectItem key={cat.value} value={cat.value} className="font-bold text-[10px] uppercase tracking-widest py-3">
                                        {cat.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </header>

            {filteredGigs.length === 0 ? (
                <div className="text-center py-24 bg-accent/5 rounded-[2.5rem] border-2 border-dashed border-accent/20">
                    <Briefcase className="h-16 w-16 text-accent mx-auto mb-4 opacity-20" />
                    <p className="text-accent/60 font-black italic text-xl uppercase tracking-tighter">No active gigs in this category.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredGigs.map((gig) => {
                        const isInterested = user && gig.interested?.includes(user.uid);
                        const isOwner = user?.uid === gig.user.uid;
                        return (
                            <Card key={gig.id} className="group overflow-hidden rounded-[2.2rem] border-none shadow-sm hover:shadow-xl transition-all bg-card flex flex-col">
                                <CardHeader className="p-6 pb-2">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="secondary" className="rounded-full bg-accent/10 text-accent border-none font-black uppercase text-[8px] tracking-widest px-3">
                                            {gig.category}
                                        </Badge>
                                        <div className="text-right flex flex-col items-end gap-1">
                                            <p className="text-lg font-black text-accent">{gig.budget || "Negotiable"}</p>
                                            {isOwner && (
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-primary" onClick={() => handleEdit(gig)}><Edit3 className="h-3.5 w-3.5" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive" onClick={() => handleDelete(gig.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <CardTitle className="text-xl font-bold leading-tight group-hover:text-accent transition-colors">{gig.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 pt-2 flex-1 space-y-4">
                                    <p className="text-muted-foreground text-sm line-clamp-3 leading-relaxed font-medium">
                                        {gig.description}
                                    </p>
                                    
                                    <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest pt-2">
                                        <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-accent" /> {formatDistanceToNow(gig.timestamp?.toDate() || new Date())} ago</div>
                                    </div>
                                </CardContent>
                                <CardFooter className="p-6 bg-muted/10 border-t flex flex-col gap-4">
                                    <div className="flex items-center justify-between w-full">
                                        <Link href={`/profile/${gig.user.username}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                                            <Avatar className="h-7 w-7 border border-accent/20">
                                                <AvatarImage src={gig.user.avatar} />
                                                <AvatarFallback>{gig.user.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-[10px] font-black text-accent truncate max-w-[90px]">@{gig.user.username}</span>
                                        </Link>
                                        <div className="flex gap-2">
                                            {isOwner ? (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => viewInterests(gig)}
                                                    className="h-9 rounded-full px-4 font-bold text-[10px] uppercase tracking-widest border-accent/20 text-accent"
                                                >
                                                    <Users className="h-3.5 w-3.5 mr-1" />
                                                    ({gig.interested?.length || 0}) Leads
                                                </Button>
                                            ) : (
                                                <Button 
                                                    variant={isInterested ? "secondary" : "default"} 
                                                    size="sm" 
                                                    onClick={() => handleInterest(gig)}
                                                    disabled={isActionLoading === gig.id}
                                                    className={cn(
                                                        "h-9 rounded-full px-4 font-bold text-[10px] uppercase tracking-widest",
                                                        !isInterested && "bg-accent hover:bg-accent/90"
                                                    )}
                                                >
                                                    {isActionLoading === gig.id ? <Loader2 className="h-3 w-3 animate-spin" /> : isInterested ? <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                                                    {isInterested ? "I'm In" : "Interested"}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {isInterested && !isOwner && (
                                        <Button 
                                            variant="outline" 
                                            className="w-full h-9 rounded-xl border-accent/30 text-accent font-black text-[9px] uppercase tracking-widest gap-2"
                                            onClick={() => handleStartChat(gig.user, gig.title)}
                                        >
                                            <MessageSquare className="h-3.5 w-3.5" /> Message Poster
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Interest Viewer Dialog */}
            <Dialog open={isInterestsOpen} onOpenChange={setIsInterestsOpen}>
                <DialogContent className="max-w-md rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Interested Students</DialogTitle>
                        <DialogDescription>People who applied for your gig request.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[400px] pr-4 my-4">
                        {loadingInterests ? (
                            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-accent" /></div>
                        ) : interestedUsers.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground italic font-medium">No one has expressed interest yet.</div>
                        ) : (
                            <div className="space-y-3">
                                {interestedUsers.map((u) => (
                                    <div key={u.uid} className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-accent/5">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10"><AvatarImage src={u.avatar} /></Avatar>
                                            <div>
                                                <p className="font-bold text-sm leading-none">{u.name}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mt-1">@{u.username}</p>
                                            </div>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            className="h-8 rounded-full font-black text-[8px] uppercase tracking-widest bg-accent hover:bg-accent/90"
                                            onClick={() => handleStartChat(u, viewingGigInterests?.title || '')}
                                        >
                                            Message
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost" className="rounded-xl">Close</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create/Edit Gig Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-[2.5rem]">
                    <DialogHeader>
                        <DialogTitle className="text-3xl font-black font-headline tracking-tighter text-accent flex items-center gap-3">
                            {gigToEdit ? 'Update Request' : 'Post a Request'} <Plus className="h-6 w-6" />
                        </DialogTitle>
                        <DialogDescription className="font-medium">What do you need help with from fellow students?</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Gig Category</Label>
                            <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                                <SelectTrigger className="h-12 rounded-2xl bg-accent/5 border-none shadow-inner"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-2xl">
                                    {CATEGORIES.filter(c => c.value !== 'all').map(cat => (
                                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Title / Short Request</Label>
                            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Need essay proofreading, looking for a delivery" className="h-12 rounded-2xl bg-accent/5 border-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Budget / Reward</Label>
                                <Input value={budget} onChange={e => setBudget(e.target.value)} placeholder="e.g. 5k, Soda, Negotiable" className="h-12 rounded-2xl bg-accent/5 border-none" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Deadline (Optional)</Label>
                                <Input value={deadline} onChange={e => setDeadline(e.target.value)} placeholder="e.g. By Friday 5pm" className="h-12 rounded-2xl bg-accent/5 border-none" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Gig Details</Label>
                            <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Explain exactly what you need..." className="min-h-[120px] rounded-[1.5rem] bg-accent/5 border-none p-4 font-medium" />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost" className="rounded-2xl h-12">Discard</Button></DialogClose>
                        <Button onClick={handlePostGig} disabled={isSaving || !title.trim() || !content.trim()} className="h-12 rounded-2xl font-black px-10 bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            {gigToEdit ? 'Update Request' : 'Board the Gig'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
