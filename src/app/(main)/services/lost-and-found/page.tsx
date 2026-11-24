"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { db, auth, storage } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { HelpCircle, Plus, Search, MapPin, Clock, ArrowLeft, Loader2, X, ImageIcon, Filter, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import NextImage from 'next/image';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

type LFItem = {
    id: string;
    type: 'lost' | 'found';
    title: string;
    description: string;
    location: string;
    imageURL?: string;
    user: {
        uid: string;
        name: string;
        username: string;
        avatar: string;
    };
    timestamp: any;
};

export default function LostAndFoundPage() {
    const [user] = useAuthState(auth);
    const { toast } = useToast();
    const [items, setItems] = useState<LFItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState<'lost' | 'found'>('lost');
    const [location, setLocation] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const q = query(collection(db, 'lost-and-found'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LFItem)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handlePublish = async () => {
        if (!user) return;
        if (!title.trim() || !content.trim() || !location.trim()) {
            toast({ variant: 'destructive', title: "Missing details", description: "Please provide a title, description, and location." });
            return;
        }

        setIsSaving(true);
        try {
            let imageURL = '';
            if (imageFile) {
                const imgRef = ref(storage, `lost-found/${user.uid}/${Date.now()}_${imageFile.name}`);
                const snap = await uploadBytes(imgRef, imageFile);
                imageURL = await getDownloadURL(snap.ref);
            }

            const userSnap = await getDoc(doc(db, 'users', user.uid));
            const userData = userSnap.data();

            await addDoc(collection(db, 'lost-and-found'), {
                title,
                description: content,
                type,
                location,
                imageURL,
                user: {
                    uid: user.uid,
                    name: userData?.name || user.displayName,
                    username: userData?.username || 'anonymous',
                    avatar: userData?.avatar || user.photoURL
                },
                timestamp: serverTimestamp()
            });

            setTitle(''); setContent(''); setLocation(''); setImageFile(null); setImagePreview(null);
            setIsCreateOpen(false);
            toast({ title: "Report Published", description: "Your post is now visible to the community." });
        } catch (e) {
            toast({ variant: 'destructive', title: "Publishing Failed" });
        } finally {
            setIsSaving(false);
        }
    };

    const filteredItems = items.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             item.location.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTab = activeTab === 'all' || item.type === activeTab;
        return matchesSearch && matchesTab;
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
                            <h1 className="text-4xl font-black font-headline tracking-tighter text-primary flex items-center gap-3">
                                Lost & Found <HelpCircle className="h-8 w-8" />
                            </h1>
                            <p className="text-muted-foreground font-medium">Helping Makerere students recover what belongs to them.</p>
                        </div>
                    </div>
                    {user && (
                        <Button onClick={() => setIsCreateOpen(true)} className="rounded-full h-12 px-8 font-black shadow-lg shadow-primary/20 flex items-center gap-2">
                            <Plus className="h-5 w-5" /> Report Item
                        </Button>
                    )}
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            placeholder="Search by item or location..." 
                            className="pl-12 h-12 bg-card rounded-2xl border-none shadow-sm" 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-card p-1 rounded-2xl shadow-sm border-none">
                        <TabsList className="bg-transparent h-10 gap-1">
                            <TabsTrigger value="all" className="rounded-xl font-bold uppercase text-[10px] tracking-widest px-6">All</TabsTrigger>
                            <TabsTrigger value="lost" className="rounded-xl font-bold uppercase text-[10px] tracking-widest px-6 data-[state=active]:bg-destructive data-[state=active]:text-white">Lost</TabsTrigger>
                            <TabsTrigger value="found" className="rounded-xl font-bold uppercase text-[10px] tracking-widest px-6 data-[state=active]:bg-green-600 data-[state=active]:text-white">Found</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </header>

            {filteredItems.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 rounded-[2.5rem] border-2 border-dashed">
                    <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                    <p className="text-muted-foreground font-bold italic">No matching reports found. Try a different search.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredItems.map((item) => (
                        <Card key={item.id} className="group overflow-hidden rounded-[2rem] border-none shadow-sm hover:shadow-md transition-all bg-card">
                            <div className="relative aspect-square bg-muted overflow-hidden">
                                {item.imageURL ? (
                                    <NextImage 
                                        src={item.imageURL} 
                                        alt={item.title} 
                                        fill 
                                        className="object-cover group-hover:scale-105 transition-transform duration-500" 
                                    />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center opacity-10">
                                        <HelpCircle className="h-20 w-20" />
                                    </div>
                                )}
                                <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg ${
                                    item.type === 'lost' ? 'bg-destructive text-white' : 'bg-green-600 text-white'
                                }`}>
                                    {item.type}
                                </div>
                            </div>
                            <CardContent className="p-6 space-y-4">
                                <div>
                                    <h3 className="font-bold text-lg leading-tight line-clamp-1 group-hover:text-primary transition-colors">{item.title}</h3>
                                    <p className="text-muted-foreground text-xs line-clamp-2 mt-1 leading-relaxed">{item.description}</p>
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        <MapPin className="h-3 w-3 text-primary" /> {item.location}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        <Clock className="h-3 w-3 text-primary" /> {formatDistanceToNow(item.timestamp?.toDate() || new Date())} ago
                                    </div>
                                </div>

                                <div className="pt-4 border-t flex items-center justify-between">
                                    <Link href={`/profile/${item.user.username}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={item.user.avatar} />
                                            <AvatarFallback>{item.user.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-[10px] font-black text-primary truncate max-w-[80px]">@{item.user.username}</span>
                                    </Link>
                                    <Button variant="outline" size="sm" asChild className="h-8 rounded-full text-[10px] font-black uppercase tracking-widest px-4 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all">
                                        <Link href={`/profile/${item.user.username}`}>Contact</Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black font-headline">Report Item</DialogTitle>
                        <DialogDescription>Let others know about something you lost or found.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Report Type</Label>
                                <Select value={type} onValueChange={(v: any) => setType(v)}>
                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="lost">Lost Item</SelectItem>
                                        <SelectItem value="found">Found Item</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Item Name</Label>
                                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. ID Card, Calculator" className="h-12 rounded-xl bg-muted/20 border-none" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Location</Label>
                            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. CIT Block B, Main Library" className="h-12 rounded-xl bg-muted/20 border-none" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Description</Label>
                            <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Describe the item (color, brand, distinguishing marks)..." className="min-h-[120px] rounded-2xl bg-muted/20 border-none p-4" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Item Photo (Optional)</Label>
                            <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
                            }} />
                            {imagePreview ? (
                                <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-primary/20">
                                    <NextImage src={imagePreview} alt="Preview" fill className="object-cover" />
                                    <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg" onClick={() => { setImageFile(null); setImagePreview(null); }}><X className="h-4 w-4" /></Button>
                                </div>
                            ) : (
                                <Button variant="outline" className="h-32 w-full rounded-2xl border-dashed border-2 flex flex-col gap-2 hover:bg-muted/50 transition-all" onClick={() => fileRef.current?.click()}>
                                    <ImageIcon className="h-6 w-6 text-primary opacity-40" />
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Upload Photo</span>
                                </Button>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost" className="rounded-xl">Cancel</Button></DialogClose>
                        <Button onClick={handlePublish} disabled={isSaving || !title.trim() || !content.trim()} className="h-12 rounded-xl font-black px-8">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Publish Report
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
