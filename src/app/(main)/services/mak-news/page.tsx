
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, storage } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, Timestamp, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Newspaper, Calendar, User, ChevronRight, Hash, ArrowLeft, Plus, Loader2, X, ImageIcon, Info, Filter, Video, Play, Sparkles, Briefcase, GraduationCap, Gavel, HeartPulse, AlignLeft, Type, Image as LucideImage, Trash2, GripVertical, Send } from 'lucide-react';
import { format } from 'date-fns';
import NextImage from 'next/image';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type StoryBlock = {
    id: string;
    type: 'text' | 'image' | 'video';
    value: string; // text content or URL
    file?: File | null;
    preview?: string | null;
};

type NewsItem = {
    id: string;
    title: string;
    content: string; // Legacy fallback
    blocks?: StoryBlock[];
    category: string;
    mediaURL?: string;
    mediaType?: 'image' | 'video';
    author: string;
    timestamp: Timestamp;
};

const CATEGORIES = [
    { label: 'All Stories', value: 'all', icon: Newspaper },
    { label: 'Campus Life', value: 'campus', icon: Sparkles },
    { label: 'Academic News', value: 'academic', icon: GraduationCap },
    { label: 'Campus Sports', value: 'sports', icon: Play },
    { label: 'Guild & Politics', value: 'politics', icon: Gavel },
    { label: 'Health & Wellness', value: 'health', icon: HeartPulse },
    { label: 'Innovation & Tech', value: 'tech', icon: Play },
    { label: 'Alumni News', value: 'alumni', icon: User },
    { label: 'Careers & Jobs', value: 'jobs', icon: Briefcase },
    { label: 'Events', value: 'events', icon: Calendar },
];

export default function MakNewsPage() {
    const [user] = useAuthState(auth);
    const { toast } = useToast();
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('all');
    const [canPost, setCanPost] = useState(false);
    const [isPublishingOpen, setIsPublishingOpen] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<any>('campus');
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [coverType, setCoverType] = useState<'image' | 'video' | null>(null);
    
    // Modular Blocks State
    const [blocks, setBlocks] = useState<StoryBlock[]>([
        { id: Math.random().toString(36).substr(2, 9), type: 'text', value: '' }
    ]);

    const [isSaving, setIsSaving] = useState(false);
    const coverFileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const q = query(collection(db, 'news'), orderBy('timestamp', 'desc'), limit(50));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setNews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsItem)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) {
            setCanPost(false);
            return;
        }
        const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
            if (snap.exists()) {
                setCanPost(!!snap.data().canPostNews);
            }
        });
        return () => unsub();
    }, [user]);

    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverFile(file);
            setCoverPreview(URL.createObjectURL(file));
            setCoverType(file.type.startsWith('video/') ? 'video' : 'image');
        }
    };

    const addBlock = (type: 'text' | 'image' | 'video') => {
        setBlocks([...blocks, { id: Math.random().toString(36).substr(2, 9), type, value: '', file: null, preview: null }]);
    };

    const removeBlock = (id: string) => {
        if (blocks.length === 1 && blocks[0].type === 'text') return;
        setBlocks(blocks.filter(b => b.id !== id));
    };

    const updateBlockText = (id: string, value: string) => {
        setBlocks(blocks.map(b => b.id === id ? { ...b, value } : b));
    };

    const handleBlockMediaChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setBlocks(blocks.map(b => b.id === id ? { 
                ...b, 
                file, 
                preview: URL.createObjectURL(file),
                value: '' // Reset value until upload
            } : b));
        }
    };

    const handlePublish = async () => {
        if (!title.trim() || blocks.every(b => b.type === 'text' && !b.value.trim())) {
            toast({ variant: 'destructive', title: "Story is empty", description: "Add a headline and some content blocks." });
            return;
        }

        setIsSaving(true);
        try {
            // 1. Upload Cover Media
            let coverURL = '';
            if (coverFile) {
                const storagePath = coverType === 'video' ? 'news_videos' : 'news';
                const imgRef = ref(storage, `${storagePath}/cover_${Date.now()}_${coverFile.name}`);
                const snap = await uploadBytes(imgRef, coverFile);
                coverURL = await getDownloadURL(snap.ref);
            }

            // 2. Upload Modular Blocks Media
            const finalBlocks = await Promise.all(blocks.map(async (block) => {
                if ((block.type === 'image' || block.type === 'video') && block.file) {
                    const folder = block.type === 'image' ? 'news_inline_images' : 'news_inline_videos';
                    const mediaRef = ref(storage, `${folder}/block_${block.id}_${Date.now()}`);
                    const snap = await uploadBytes(mediaRef, block.file);
                    const url = await getDownloadURL(snap.ref);
                    return { id: block.id, type: block.type, value: url };
                }
                return { id: block.id, type: block.type, value: block.value };
            }));

            const userSnap = await getDoc(doc(db, 'users', user!.uid));
            const userName = userSnap.data()?.name || 'Authorized Contributor';

            // Filter out empty text blocks
            const validBlocks = finalBlocks.filter(b => b.type !== 'text' || b.value.trim() !== '');

            await addDoc(collection(db, 'news'), {
                title,
                category,
                mediaURL: coverURL,
                mediaType: coverType || 'image',
                blocks: validBlocks,
                content: validBlocks.find(b => b.type === 'text')?.value || '', // Legacy support
                author: userName,
                timestamp: serverTimestamp()
            });

            // Reset
            setTitle(''); setCategory('campus'); setCoverFile(null); setCoverPreview(null); setCoverType(null);
            setBlocks([{ id: Math.random().toString(36).substr(2, 9), type: 'text', value: '' }]);
            setIsPublishingOpen(false);
            toast({ title: "Story Published", description: "Your modular campus story is now live." });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: "Publishing Failed" });
        } finally {
            setIsSaving(false);
        }
    };

    const filteredNews = useMemo(() => {
        if (activeCategory === 'all') return news;
        return news.filter(item => item.category === activeCategory);
    }, [news, activeCategory]);

    const topStory = useMemo(() => filteredNews[0], [filteredNews]);
    const remainingStories = useMemo(() => filteredNews.slice(1), [filteredNews]);

    if (loading) {
        return (
            <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
                <Skeleton className="h-12 w-48 mb-6" />
                <Skeleton className="h-[400px] w-full rounded-3xl" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto pb-24">
            {/* Create News Dialog */}
            <Dialog open={isPublishingOpen} onOpenChange={setIsPublishingOpen}>
                <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto rounded-[2.5rem] p-0 border-none shadow-2xl">
                    <DialogHeader className="p-8 pb-4 bg-muted/10">
                        <DialogTitle className="text-3xl font-black font-headline tracking-tight">Create Modular Story</DialogTitle>
                        <DialogDescription className="font-medium">Mix text, images, and videos to tell your campus update.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="p-8 pt-4 space-y-8">
                        {/* Header Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Headline</Label>
                                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Catchy title..." className="h-14 rounded-2xl bg-muted/20 border-none text-lg font-bold px-6" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Topic</Label>
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger className="h-14 rounded-2xl bg-muted/20 border-none px-6 font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-2xl">
                                        {CATEGORIES.filter(c => c.value !== 'all').map(cat => (
                                            <SelectItem key={cat.value} value={cat.value} className="font-bold py-3 uppercase text-[10px] tracking-widest">{cat.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Cover Media */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Main Cover Media (Image/Video)</Label>
                            <input type="file" accept="image/*,video/*" className="hidden" ref={coverFileRef} onChange={handleCoverChange} />
                            {coverPreview ? (
                                <div className="relative aspect-video rounded-3xl overflow-hidden border-4 border-primary/10 bg-black group">
                                    {coverType === 'video' ? (
                                        <video src={coverPreview} controls className="h-full w-full object-contain" />
                                    ) : (
                                        <NextImage src={coverPreview} alt="Preview" fill className="object-cover" />
                                    )}
                                    <Button variant="destructive" size="icon" className="absolute top-4 right-4 h-10 w-10 rounded-full shadow-2xl z-10 opacity-0 group-hover:opacity-100 transition-all" onClick={() => { setCoverFile(null); setCoverPreview(null); setCoverType(null); }}><X className="h-5 w-5" /></Button>
                                </div>
                            ) : (
                                <Button variant="outline" className="h-48 w-full rounded-[2rem] border-dashed border-2 border-primary/20 flex flex-col gap-3 hover:bg-primary/5 hover:border-primary/40 transition-all group" onClick={() => coverFileRef.current?.click()}>
                                    <div className="flex gap-4 group-hover:scale-110 transition-transform">
                                        <ImageIcon className="h-8 w-8 text-primary opacity-40" />
                                        <Video className="h-8 w-8 text-primary opacity-40" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Upload Story Cover</span>
                                </Button>
                            )}
                        </div>

                        <Separator className="bg-primary/5 h-1 rounded-full" />

                        {/* Modular Sections */}
                        <div className="space-y-6">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Story Sections</Label>
                            <div className="space-y-4">
                                {blocks.map((block, index) => (
                                    <div key={block.id} className="relative group animate-in slide-in-from-bottom-2 duration-300">
                                        <div className="absolute -left-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 opacity-0 group-hover:opacity-40 transition-opacity">
                                            <GripVertical className="h-4 w-4" />
                                        </div>
                                        
                                        <Card className="rounded-2xl border-none shadow-sm bg-muted/10 overflow-hidden">
                                            <div className="p-1 flex items-center justify-between bg-muted/20 border-b">
                                                <div className="flex items-center gap-2 px-3 py-1">
                                                    {block.type === 'text' && <Type className="h-3 w-3 text-muted-foreground" />}
                                                    {block.type === 'image' && <LucideImage className="h-3 w-3 text-muted-foreground" />}
                                                    {block.type === 'video' && <Video className="h-3 w-3 text-muted-foreground" />}
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Section {index + 1}: {block.type}</span>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 rounded-full" onClick={() => removeBlock(block.id)} disabled={blocks.length === 1 && block.type === 'text'}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                            
                                            <CardContent className="p-4">
                                                {block.type === 'text' ? (
                                                    <Textarea 
                                                        value={block.value} 
                                                        onChange={e => updateBlockText(block.id, e.target.value)} 
                                                        placeholder="Write part of the story..." 
                                                        className="min-h-[120px] bg-transparent border-none resize-none p-0 focus-visible:ring-0 text-md leading-relaxed"
                                                    />
                                                ) : (
                                                    <div className="space-y-3">
                                                        <input 
                                                            type="file" 
                                                            accept={block.type === 'image' ? "image/*" : "video/*"} 
                                                            className="hidden" 
                                                            id={`file-${block.id}`}
                                                            onChange={e => handleBlockMediaChange(block.id, e)}
                                                        />
                                                        {block.preview ? (
                                                            <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
                                                                {block.type === 'video' ? (
                                                                    <video src={block.preview} className="h-full w-full object-contain" controls />
                                                                ) : (
                                                                    <NextImage src={block.preview} alt="Section media" fill className="object-cover" />
                                                                )}
                                                                <label htmlFor={`file-${block.id}`} className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest cursor-pointer hover:bg-black/70 transition-all">Replace</label>
                                                            </div>
                                                        ) : (
                                                            <label htmlFor={`file-${block.id}`} className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-all gap-2">
                                                                {block.type === 'image' ? <LucideImage className="h-6 w-6 text-muted-foreground opacity-40" /> : <Video className="h-6 w-6 text-muted-foreground opacity-40" />}
                                                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Upload {block.type}</span>
                                                            </label>
                                                        )}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                                <Button variant="outline" size="sm" onClick={() => addBlock('text')} className="rounded-full h-10 px-6 font-bold gap-2 border-primary/20 text-primary">
                                    <Type className="h-4 w-4" /> Add Text
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => addBlock('image')} className="rounded-full h-10 px-6 font-bold gap-2 border-primary/20 text-primary">
                                    <LucideImage className="h-4 w-4" /> Add Image
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => addBlock('video')} className="rounded-full h-10 px-6 font-bold gap-2 border-primary/20 text-primary">
                                    <Video className="h-4 w-4" /> Add Video
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-8 bg-muted/10 border-t sticky bottom-0">
                        <DialogClose asChild><Button variant="ghost" className="rounded-xl h-12">Discard</Button></DialogClose>
                        <Button onClick={handlePublish} disabled={isSaving || !title.trim()} className="h-12 rounded-xl font-black px-12 shadow-lg shadow-primary/20 min-w-[200px]">
                            {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                            {isSaving ? 'Processing...' : 'Publish Story'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <header className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" asChild className="rounded-full">
                            <Link href="/services"><ArrowLeft className="h-5 w-5" /></Link>
                        </Button>
                        <div>
                            <h1 className="text-4xl font-black font-headline tracking-tighter text-primary flex items-center gap-2">
                                MakNews <Newspaper className="h-8 w-8" />
                            </h1>
                            <p className="text-muted-foreground font-medium">The official campus journal of Makerere.</p>
                        </div>
                    </div>
                    {canPost && (
                        <Button onClick={() => setIsPublishingOpen(true)} className="rounded-full h-12 px-8 font-black shadow-lg shadow-primary/20 flex items-center gap-2">
                            <Plus className="h-5 w-5" /> Contribute News
                        </Button>
                    )}
                </div>

                <div className="w-full md:w-72">
                    <Select value={activeCategory} onValueChange={setActiveCategory}>
                        <SelectTrigger className="h-12 rounded-2xl bg-card border-none shadow-sm font-bold text-[10px] uppercase tracking-widest px-6 ring-offset-background focus:ring-2 focus:ring-primary">
                            <div className="flex items-center gap-2">
                                <Filter className="h-3.5 w-3.5 text-primary" />
                                <SelectValue placeholder="Genre Filter" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                            {CATEGORIES.map((cat) => (
                                <SelectItem 
                                    key={cat.value} 
                                    value={cat.value} 
                                    className="font-bold text-[10px] uppercase tracking-widest py-3 cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <cat.icon className="h-3 w-3" />
                                        {cat.label}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </header>

            {filteredNews.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed">
                    <Newspaper className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                    <p className="text-muted-foreground font-bold italic">No stories published in this category yet.</p>
                </div>
            ) : (
                <>
                    {/* Top Story */}
                    {topStory && (
                        <Card className="group overflow-hidden rounded-[2.5rem] border-none shadow-xl bg-card transition-all hover:shadow-2xl">
                            <div className="grid grid-cols-1 lg:grid-cols-2">
                                <div className="relative aspect-video lg:aspect-auto h-full min-h-[350px] bg-black overflow-hidden">
                                    {topStory.mediaURL ? (
                                        topStory.mediaType === 'video' ? (
                                            <video src={topStory.mediaURL} controls className="h-full w-full object-contain" />
                                        ) : (
                                            <NextImage 
                                                src={topStory.mediaURL} 
                                                alt={topStory.title} 
                                                fill 
                                                className="object-cover group-hover:scale-105 transition-transform duration-1000"
                                                sizes="(max-width: 1024px) 100vw, 800px"
                                            />
                                        )
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center opacity-10 bg-muted"><Newspaper className="h-24 w-24" /></div>
                                    )}
                                    <div className="absolute top-6 left-6 bg-primary text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg uppercase tracking-widest z-10">
                                        Spotlight
                                    </div>
                                </div>
                                <div className="p-10 lg:p-12 flex flex-col justify-center space-y-6">
                                    <div className="flex items-center gap-2 text-primary font-black uppercase text-[11px] tracking-tighter">
                                        <Hash className="h-4 w-4" /> {topStory.category}
                                    </div>
                                    <h2 className="text-4xl lg:text-5xl font-black font-headline leading-[1.1] tracking-tight group-hover:text-primary transition-colors">
                                        {topStory.title}
                                    </h2>
                                    
                                    {/* Render modular content preview */}
                                    <div className="space-y-4 max-h-[300px] overflow-hidden relative">
                                        {topStory.blocks ? (
                                            topStory.blocks.map((block, i) => (
                                                <div key={i}>
                                                    {block.type === 'text' ? (
                                                        <p className={cn("text-muted-foreground leading-relaxed font-medium", i === 0 ? "line-clamp-4" : "hidden")}>
                                                            {block.value}
                                                        </p>
                                                    ) : (
                                                        <div className={cn("relative aspect-video rounded-2xl overflow-hidden bg-muted/50 border", i === 0 ? "" : "hidden")}>
                                                            {block.type === 'video' ? <Video className="m-auto h-8 w-8 opacity-20" /> : <LucideImage className="m-auto h-8 w-8 opacity-20" />}
                                                            {block.type === 'video' ? <video src={block.value} className="h-full w-full object-cover" muted /> : <NextImage src={block.value} alt="" fill className="object-cover" />}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-muted-foreground line-clamp-4 font-medium leading-relaxed">
                                                {topStory.content}
                                            </p>
                                        )}
                                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent" />
                                    </div>

                                    <div className="pt-6 flex items-center justify-between border-t border-primary/10">
                                        <div className="flex items-center gap-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                            <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary/60" /> {topStory.timestamp ? format(topStory.timestamp.toDate(), 'MMMM d, yyyy') : 'Recently'}</span>
                                            <span className="flex items-center gap-2"><User className="h-4 w-4 text-primary/60" /> {topStory.author}</span>
                                        </div>
                                        <Button variant="ghost" className="font-black text-primary gap-2 hover:bg-primary/5 px-6 rounded-full h-12 uppercase text-[10px] tracking-widest">
                                            Read Full Story <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Secondary Stories */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {remainingStories.map((item) => (
                            <Card key={item.id} className="group overflow-hidden rounded-[2rem] border-none shadow-sm hover:shadow-xl transition-all bg-card flex flex-col">
                                <div className="relative aspect-video bg-black overflow-hidden">
                                    {item.mediaURL ? (
                                        item.mediaType === 'video' ? (
                                            <video src={item.mediaURL} muted playsInline onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} className="h-full w-full object-cover opacity-80" />
                                        ) : (
                                            <NextImage src={item.mediaURL} alt={item.title} fill className="object-cover group-hover:scale-110 transition-transform duration-700" sizes="400px" />
                                        )
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center opacity-10 bg-muted"><Newspaper className="h-12 w-12" /></div>
                                    )}
                                    <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest z-10 border border-white/10">
                                        {item.category}
                                    </div>
                                    {item.mediaType === 'video' && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-all">
                                            <Play className="h-10 w-10 text-white drop-shadow-lg" />
                                        </div>
                                    )}
                                </div>
                                <CardContent className="p-7 space-y-4 flex-1 flex flex-col">
                                    <h3 className="font-black font-headline text-xl line-clamp-2 leading-[1.2] group-hover:text-primary transition-colors">{item.title}</h3>
                                    
                                    <div className="text-muted-foreground text-sm line-clamp-3 leading-relaxed font-medium flex-1">
                                        {item.blocks?.find(b => b.type === 'text')?.value || item.content}
                                    </div>
                                    
                                    <div className="pt-4 flex items-center justify-between border-t border-primary/5 text-[9px] text-muted-foreground uppercase font-black tracking-widest">
                                        <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {item.timestamp ? format(item.timestamp.toDate(), 'MMM d') : 'Now'}</span>
                                        <span className="text-primary group-hover:translate-x-1 transition-transform flex items-center gap-1">Read Story <ChevronRight className="h-3 w-3" /></span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
