
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db, auth, storage } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, Timestamp, writeBatch, getDocs, where, getDoc, setDoc, updateDoc, limit, serverTimestamp, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Trash2, CheckCircle, ShieldAlert, Clock, User, BarChart3, Settings2, Flag, ExternalLink, Megaphone, MessageSquare, ShoppingBag, ShieldCheck, Construction, Ban, Unlock, Info, ChevronDown, LayoutDashboard, Landmark, Newspaper, Plus, ImageIcon, X, Radio, Coffee, UtensilsCrossed, HelpCircle, Briefcase, Filter, Globe, Edit3, Save, Send, Zap, Sparkles, Video, Type, Image as LucideImage, Play, GraduationCap, Gavel, HeartPulse, Calendar, BookOpen, BadgeCheck, Fingerprint, Hash, StickyNote, Search } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import NextImage from 'next/image';

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

type Report = {
    id: string;
    type: 'post' | 'poll' | 'listing';
    entityId: string;
    content: string;
    authorName: string;
    timestamp: Timestamp;
    reporterId: string;
};

type AppSettings = {
    announcement: string;
    announcementActive: boolean;
    manualCuriaOpen: boolean;
    maintenanceMode: boolean;
    siteTitle: string;
    siteDescription: string;
};

type StoryBlock = {
    id: string;
    type: 'text' | 'image' | 'video';
    value: string;
    file?: File | null;
    preview?: string | null;
};

type MenuItem = {
    name: string;
    price: string;
};

const SuspensionDialog = ({ 
    user, 
    onConfirm, 
    open, 
    onOpenChange 
}: { 
    user: any, 
    onConfirm: (reason: string, hours: number) => void, 
    open: boolean, 
    onOpenChange: (open: boolean) => void 
}) => {
    const [reason, setReason] = useState('');
    const [hours, setHours] = useState('24');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        if (!reason.trim()) return;
        setIsSubmitting(true);
        await onConfirm(reason, parseInt(hours));
        setIsSubmitting(false);
        onOpenChange(false);
        setReason('');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-[2rem]">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black">Suspend Student</DialogTitle>
                    <DialogDescription className="font-medium">Apply a time-locked block on @{user?.username}.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Reason for Suspension</Label>
                        <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Harassment in The Curia" className="rounded-xl h-12" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Duration (Hours)</Label>
                        <Input type="number" value={hours} onChange={e => setHours(e.target.value)} className="rounded-xl h-12" />
                        <p className="text-[10px] text-muted-foreground italic">Standard: 24h (1 day), 168h (1 week), 720h (1 month)</p>
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <DialogClose asChild><Button variant="outline" className="rounded-xl">Cancel</Button></DialogClose>
                    <Button variant="destructive" onClick={handleConfirm} disabled={isSubmitting || !reason.trim()} className="rounded-xl font-bold">
                        Confirm Suspension
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [accessCode, setAccessCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const { toast } = useToast();

    const [stats, setStats] = useState({ users: 0, posts: 0, listings: 0, reports: 0, curia: 0, news: 0, menus: 0, lostFound: 0, gigs: 0 });
    const [reports, setReports] = useState<Report[]>([]);
    const [userList, setUserList] = useState<any[]>([]);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [allPosts, setAllPosts] = useState<any[]>([]);
    const [curiaPosts, setCuriaPosts] = useState<any[]>([]);
    const [allListings, setAllListings] = useState<any[]>([]);
    const [newsItems, setNewsItems] = useState<any[]>([]);
    const [cafeteriaMenus, setCafeteriaMenus] = useState<any[]>([]);
    const [lostFoundItems, setLostFoundItems] = useState<any[]>([]);
    const [gigItems, setGigItems] = useState<any[]>([]);
    const [selectedUserForSuspension, setSelectedUserForSuspension] = useState<any>(null);
    const [activeTab, setActiveTab] = useState('moderation');
    const [appSettings, setAppSettings] = useState<AppSettings>({
        announcement: '',
        announcementActive: false,
        manualCuriaOpen: false,
        maintenanceMode: false,
        siteTitle: 'MakChat',
        siteDescription: 'The social network for Makerere University students.'
    });

    const [adminGigCategory, setAdminGigCategory] = useState('all');

    // News Creator State
    const [isNewsDialogOpen, setIsNewsDialogOpen] = useState(false);
    const [newsTitle, setNewsTitle] = useState('');
    const [newsCategory, setNewsCategory] = useState('campus');
    const [newsCoverMedia, setNewsCoverMedia] = useState<File | null>(null);
    const [newsCoverPreview, setNewsCoverPreview] = useState<string | null>(null);
    const [newsCoverType, setNewsCoverType] = useState<'image' | 'video' | null>(null);
    const [newsBlocks, setNewsBlocks] = useState<StoryBlock[]>([
        { id: Math.random().toString(36).substr(2, 9), type: 'text', value: '' }
    ]);

    // Menu Creator State
    const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);
    const [menuToEdit, setMenuToEdit] = useState<any>(null);
    const [menuCafeteria, setMenuCafeteria] = useState('');
    const [menuNote, setMenuNote] = useState('');
    const [breakfastItems, setBreakfastItems] = useState<MenuItem[]>([{name: '', price: ''}]);
    const [lunchItems, setLunchItems] = useState<MenuItem[]>([{name: '', price: ''}]);

    // Broadcast State
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastBody, setBroadcastBody] = useState('');
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    const REQUIRED_CODE = 'nuwagabawright4105';

    const SECTIONS = [
        { label: 'Moderation Queue', value: 'moderation', icon: ShieldCheck },
        { label: 'Student Directory', value: 'students', icon: User },
        { label: 'Feed & Curia Posts', value: 'content', icon: MessageSquare },
        { label: 'MakMart Items', value: 'alllistings', icon: ShoppingBag },
        { label: 'MakNews Management', value: 'news', icon: Newspaper },
        { label: 'Cafeteria Menus', value: 'menus', icon: UtensilsCrossed },
        { label: 'Lost & Found', value: 'lostfound', icon: HelpCircle },
        { label: 'The Gig Board', value: 'gigboard', icon: Briefcase },
        { label: 'Broadcast Center', value: 'broadcast', icon: Zap },
        { label: 'System Config', value: 'config', icon: Settings2 },
    ];

    const activeTabLabel = useMemo(() => SECTIONS.find(s => s.value === activeTab)?.label || 'Moderation', [activeTab]);

    useEffect(() => {
        if (!isAuthenticated) return;

        setLoading(true);

        const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
            setStats(prev => ({ ...prev, users: snap.size }));
            setUserList(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
        });

        const unsubPosts = onSnapshot(query(collection(db, 'posts'), orderBy('timestamp', 'desc'), limit(100)), snap => {
            setStats(prev => ({ ...prev, posts: snap.size }));
            setAllPosts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubCuria = onSnapshot(query(collection(db, 'curia'), orderBy('timestamp', 'desc'), limit(100)), snap => {
            setStats(prev => ({ ...prev, curia: snap.size }));
            setCuriaPosts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubListings = onSnapshot(query(collection(db, 'mak-mart-listings'), orderBy('timestamp', 'desc')), snap => {
            setStats(prev => ({ ...prev, listings: snap.size }));
            setAllListings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubNews = onSnapshot(query(collection(db, 'news'), orderBy('timestamp', 'desc')), snap => {
            setStats(prev => ({ ...prev, news: snap.size }));
            setNewsItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubMenus = onSnapshot(query(collection(db, 'cafeteria-menus'), orderBy('timestamp', 'desc')), snap => {
            setStats(prev => ({ ...prev, menus: snap.size }));
            setCafeteriaMenus(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubLostFound = onSnapshot(query(collection(db, 'lost-and-found'), orderBy('timestamp', 'desc')), snap => {
            setStats(prev => ({ ...prev, lostFound: snap.size }));
            setLostFoundItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubGigs = onSnapshot(query(collection(db, 'gigs'), orderBy('timestamp', 'desc')), snap => {
            setStats(prev => ({ ...prev, gigs: snap.size }));
            setGigItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        
        const qReports = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
        const unsubReports = onSnapshot(qReports, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
            setReports(fetched);
            setStats(prev => ({ ...prev, reports: fetched.length }));
            setLoading(false);
        }, () => {});

        const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
            if (doc.exists()) {
                setAppSettings(prev => ({ ...prev, ...doc.data() }));
            }
        });

        return () => {
            unsubUsers(); unsubPosts(); unsubCuria(); unsubListings(); unsubReports(); unsubSettings(); unsubNews(); unsubMenus(); unsubLostFound(); unsubGigs();
        };
    }, [isAuthenticated]);

    const handleAuthenticate = (e: React.FormEvent) => {
        e.preventDefault();
        if (accessCode === REQUIRED_CODE) {
            setIsAuthenticated(true);
            toast({ title: "Access Granted" });
        } else {
            toast({ variant: "destructive", title: "Access Denied" });
        }
    };

    const handleUpdateSettings = async (updates: Partial<AppSettings>) => {
        try {
            const settingsRef = doc(db, 'settings', 'global');
            await setDoc(settingsRef, { ...appSettings, ...updates }, { merge: true });
            toast({ title: "Configuration Updated" });
        } catch (error) {
            toast({ variant: "destructive", title: "Update Failed" });
        }
    };

    const handleDeleteContent = async (type: string, id: string) => {
        if (deleteConfirm !== 'DELETE') return;
        setIsActionLoading(id);
        try {
            const batch = writeBatch(db);
            const colMap: any = { 
                post: 'posts', 
                poll: 'polls', 
                listing: 'mak-mart-listings', 
                curia: 'curia', 
                news: 'news',
                menu: 'cafeteria-menus',
                lostfound: 'lost-and-found',
                gig: 'gigs'
            };
            const entityRef = doc(db, colMap[type], id);
            
            if (type === 'post' || type === 'curia') {
                const commentsSnap = await getDocs(collection(entityRef, 'comments'));
                commentsSnap.forEach(c => { 
                    batch.delete(c.ref); 
                    batch.delete(doc(db, 'comments', c.id)); 
                });
            }
            
            batch.delete(entityRef);
            const related = await getDocs(query(collection(db, 'reports'), where('entityId', '==', id)));
            related.forEach(r => batch.delete(r.ref));
            
            await batch.commit();
            toast({ title: "Content Removed" });
            setDeleteConfirm('');
        } catch (error) {
            toast({ variant: "destructive", title: "Deletion Failed" });
        } finally {
            setIsActionLoading(null);
        }
    };

    const addNewsBlock = (type: 'text' | 'image' | 'video') => {
        setNewsBlocks([...newsBlocks, { id: Math.random().toString(36).substr(2, 9), type, value: '', file: null, preview: null }]);
    };

    const removeNewsBlock = (id: string) => {
        if (newsBlocks.length === 1 && newsBlocks[0].type === 'text') return;
        setNewsBlocks(newsBlocks.filter(b => b.id !== id));
    };

    const handleCreateNews = async () => {
        if (!newsTitle.trim() || newsBlocks.every(b => b.type === 'text' && !b.value.trim())) return;
        setIsActionLoading('creating-news');
        try {
            // 1. Cover
            let coverURL = '';
            if (newsCoverMedia) {
                const storagePath = newsCoverType === 'video' ? 'news_videos' : 'news';
                const imgRef = ref(storage, `${storagePath}/admin_cover_${Date.now()}`);
                const snap = await uploadBytes(imgRef, newsCoverMedia);
                coverURL = await getDownloadURL(snap.ref);
            }

            // 2. Blocks
            const finalBlocks = await Promise.all(newsBlocks.map(async (block) => {
                if ((block.type === 'image' || block.type === 'video') && block.file) {
                    const folder = block.type === 'image' ? 'news_inline_images' : 'news_inline_videos';
                    const mediaRef = ref(storage, `${folder}/admin_block_${block.id}_${Date.now()}`);
                    const snap = await uploadBytes(mediaRef, block.file);
                    const url = await getDownloadURL(snap.ref);
                    return { id: block.id, type: block.type, value: url };
                }
                return { id: block.id, type: block.type, value: block.value };
            }));

            const validBlocks = finalBlocks.filter(b => b.type !== 'text' || b.value.trim() !== '');

            await addDoc(collection(db, 'news'), {
                title: newsTitle,
                category: newsCategory,
                mediaURL: coverURL,
                mediaType: newsCoverType || 'image',
                blocks: validBlocks,
                content: validBlocks.find(b => b.type === 'text')?.value || '', // Legacy
                author: 'MakChat Admin',
                timestamp: serverTimestamp()
            });

            setNewsTitle(''); setNewsCoverMedia(null); setNewsCoverPreview(null); setNewsCoverType(null);
            setNewsBlocks([{ id: Math.random().toString(36).substr(2, 9), type: 'text', value: '' }]);
            setIsNewsDialogOpen(false);
            toast({ title: "Modular News Published!" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Publish Failed" });
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleCreateMenu = async () => {
        if (!menuCafeteria.trim()) return;
        const bFiltered = breakfastItems.filter(i => i.name.trim() !== "");
        const lFiltered = lunchItems.filter(i => i.name.trim() !== "");
        
        if (bFiltered.length === 0 && lFiltered.length === 0) {
            toast({ variant: 'destructive', title: "Menu Empty", description: "Add at least one item to breakfast or lunch." });
            return;
        }

        setIsActionLoading('creating-menu');
        try {
            const menuData = {
                cafeteriaName: menuCafeteria,
                note: menuNote,
                breakfastItems: bFiltered,
                lunchItems: lFiltered,
                timestamp: serverTimestamp()
            };

            if (menuToEdit) {
                await updateDoc(doc(db, 'cafeteria-menus', menuToEdit.id), menuData);
                toast({ title: "Menu Updated!" });
            } else {
                await addDoc(collection(db, 'cafeteria-menus'), menuData);
                toast({ title: "Menu Published!" });
            }
            
            setMenuCafeteria(''); 
            setMenuNote('');
            setBreakfastItems([{name: '', price: ''}]);
            setLunchItems([{name: '', price: ''}]);
            setIsMenuDialogOpen(false);
            setMenuToEdit(null);
        } catch (e) {
            toast({ variant: 'destructive', title: "Menu Save Failed" });
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleEditMenu = (menu: any) => {
        setMenuToEdit(menu);
        setMenuCafeteria(menu.cafeteriaName);
        setMenuNote(menu.note || '');
        setBreakfastItems(menu.breakfastItems?.length > 0 ? menu.breakfastItems : [{name: '', price: ''}]);
        setLunchItems(menu.lunchItems?.length > 0 ? menu.lunchItems : [{name: '', price: ''}]);
        setIsMenuDialogOpen(true);
    };

    const handleDeleteUser = async (userId: string) => {
        if (deleteConfirm !== 'DELETE') return;
        setIsActionLoading(userId);
        try {
            const batch = writeBatch(db);
            batch.delete(doc(db, 'users', userId));
            const postsSnap = await getDocs(query(collection(db, 'posts'), where('user.uid', '==', userId)));
            postsSnap.forEach(p => batch.delete(p.ref));
            await batch.commit();
            toast({ title: "Student Nuked" });
            setDeleteConfirm('');
        } catch (error) {
            toast({ variant: "destructive", title: "Nuke Failed" });
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleToggleNewsPermission = async (userId: string, currentVal: boolean) => {
        setIsActionLoading(userId);
        try {
            await updateDoc(doc(db, 'users', userId), {
                canPostNews: !currentVal
            });
            toast({ title: !currentVal ? "Permission Granted" : "Permission Revoked" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Update Failed" });
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleToggleVerification = async (userId: string, currentVal: boolean) => {
        setIsActionLoading(userId + '-verify');
        try {
            await updateDoc(doc(db, 'users', userId), {
                isVerified: !currentVal,
                isGreen: false, // Mutual exclusivity
                verifiedAt: !currentVal ? serverTimestamp() : null
            });
            toast({ title: !currentVal ? "Student Verified (Blue)!" : "Verification Revoked" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Update Failed" });
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleToggleGreenBadge = async (userId: string, currentVal: boolean) => {
        setIsActionLoading(userId + '-green');
        try {
            await updateDoc(doc(db, 'users', userId), {
                isGreen: !currentVal,
                isVerified: false, // Mutual exclusivity
            });
            toast({ title: !currentVal ? "Green Badge Assigned!" : "Badge Revoked" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Update Failed" });
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleApplySuspension = async (reason: string, hours: number) => {
        if (!selectedUserForSuspension) return;
        setIsActionLoading(selectedUserForSuspension.uid);
        try {
            const now = new Date();
            const expires = new Date(now.getTime() + (hours * 60 * 60 * 1000));
            
            await updateDoc(doc(db, 'users', selectedUserForSuspension.uid), {
                suspended: true,
                suspensionReason: reason,
                suspendedAt: serverTimestamp(),
                suspendsUntil: Timestamp.fromDate(expires)
            });
            toast({ title: "Student Blocked" });
        } catch (error) {
            toast({ variant: "destructive", title: "Action Failed" });
        } finally {
            setIsActionLoading(null);
            setSelectedUserForSuspension(null);
        }
    };

    const handleLiftSuspension = async (userId: string) => {
        setIsActionLoading(userId);
        try {
            await updateDoc(doc(db, 'users', userId), {
                suspended: false,
                suspensionReason: null,
                suspendedAt: null,
                suspendsUntil: null
            });
            toast({ title: "Suspension Lifted" });
        } catch (error) {
            toast({ variant: "destructive", title: "Action Failed" });
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleBroadcastPush = async (customTitle?: string, customBody?: string) => {
        const title = customTitle || broadcastTitle;
        const body = customBody || broadcastBody;
        
        if (!title.trim() || !body.trim()) return;
        setIsBroadcasting(true);
        try {
            const response = await fetch('/api/admin/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    body,
                    secret: REQUIRED_CODE,
                    clickAction: customTitle ? '/curia' : '/home'
                }),
            });
            const data = await response.json();
            if (data.success) {
                toast({ title: "Broadcast Sent!", description: `Successfully notified ${data.count} devices.` });
                if (!customTitle) {
                  setBroadcastTitle('');
                  setBroadcastBody('');
                }
            } else {
                throw new Error(data.error);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Broadcast Failed", description: e.message });
        } finally {
            setIsBroadcasting(false);
        }
    };

    const filteredGigs = useMemo(() => {
        if (adminGigCategory === 'all') return gigItems;
        return gigItems.filter(g => g.category === adminGigCategory);
    }, [gigItems, adminGigCategory]);

    const filteredUserList = useMemo(() => {
        if (!userSearchTerm.trim()) return userList;
        const term = userSearchTerm.toLowerCase();
        return userList.filter(u => 
            u.name?.toLowerCase().includes(term) || 
            u.username?.toLowerCase().includes(term) ||
            u.studentNumber?.toLowerCase().includes(term) ||
            u.registrationNumber?.toLowerCase().includes(term)
        );
    }, [userList, userSearchTerm]);

    if (!isAuthenticated) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] p-4">
                <Card className="w-full max-md rounded-[2rem] border-none shadow-2xl">
                    <CardHeader className="text-center pt-10">
                        <div className="h-16 w-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                            <ShieldAlert className="h-8 w-8 text-primary" />
                        </div>
                        <CardTitle className="text-3xl font-black font-headline tracking-tighter">
                            Campus Admin
                        </CardTitle>
                        <CardDescription className="font-medium">Enter developer code to unlock authority.</CardDescription>
                    </CardHeader>
                    <CardContent className="pb-10 px-8">
                        <form onSubmit={handleAuthenticate} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="code" className="text-[10px] font-black uppercase tracking-widest opacity-60">Developer Code</Label>
                                <Input id="code" type="password" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="••••••••" autoFocus className="h-12 rounded-xl text-center font-black tracking-widest" />
                            </div>
                            <Button type="submit" className="w-full h-12 rounded-xl font-black uppercase tracking-widest bg-primary text-white shadow-lg shadow-primary/20">Unlock Command Center</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-24">
            <SuspensionDialog 
                user={selectedUserForSuspension} 
                open={!!selectedUserForSuspension} 
                onOpenChange={(open) => !open && setSelectedUserForSuspension(null)}
                onConfirm={handleApplySuspension}
            />

            {/* News Creation Dialog (Modular) */}
            <Dialog open={isNewsDialogOpen} onOpenChange={setIsNewsDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-0 border-none shadow-2xl">
                    <DialogHeader className="p-8 pb-4 bg-muted/10">
                        <DialogTitle className="text-2xl font-black">Publish Modular News</DialogTitle>
                        <DialogDescription>Mix text, images, and videos for official campus updates.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="p-8 pt-4 space-y-8">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest">Headline</Label>
                                <Input value={newsTitle} onChange={e => setNewsTitle(e.target.value)} placeholder="Main Headline..." className="h-12 rounded-xl font-bold" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest">Category</Label>
                                <Select value={newsCategory} onValueChange={setNewsCategory}>
                                    <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {CATEGORIES.filter(c => c.value !== 'all').map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest">Cover Media</Label>
                            <input type="file" accept="image/*,video/*" className="hidden" id="news-cover-input" onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    setNewsCoverMedia(file);
                                    setNewsCoverPreview(URL.createObjectURL(file));
                                    setNewsCoverType(file.type.startsWith('video/') ? 'video' : 'image');
                                }
                            }} />
                            {newsCoverPreview ? (
                                <div className="relative aspect-video rounded-2xl overflow-hidden bg-black group">
                                    {newsCoverType === 'video' ? <video src={newsCoverPreview} controls className="h-full w-full object-contain" /> : <NextImage src={newsCoverPreview} alt="" fill className="object-cover" />}
                                    <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-all" onClick={() => { setNewsCoverMedia(null); setNewsCoverPreview(null); setNewsCoverType(null); }}><X className="h-4 w-4" /></Button>
                                </div>
                            ) : (
                                <Button variant="outline" className="h-32 w-full rounded-2xl border-dashed border-2 flex flex-col gap-2 hover:bg-muted/50" onClick={() => document.getElementById('news-cover-input')?.click()}>
                                    <ImageIcon className="h-6 w-6 text-primary opacity-40" />
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Set Cover Media</span>
                                </Button>
                            )}
                        </div>

                        <div className="space-y-6">
                            <Label className="text-[10px] font-black uppercase tracking-widest">Story Blocks</Label>
                            <div className="space-y-4">
                                {newsBlocks.map((block, idx) => (
                                    <div key={block.id} className="relative group p-4 bg-muted/10 rounded-2xl border border-primary/5">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">{block.type} Block</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeNewsBlock(block.id)} disabled={newsBlocks.length === 1}><Trash2 className="h-3.5 w-3.5" /></Button>
                                        </div>
                                        {block.type === 'text' ? (
                                            <Textarea value={block.value} onChange={e => setNewsBlocks(newsBlocks.map(b => b.id === block.id ? { ...b, value: e.target.value } : b))} className="min-h-[100px] rounded-xl" placeholder="Story text..." />
                                        ) : (
                                            <div className="space-y-3">
                                                <input type="file" accept={block.type === 'image' ? "image/*" : "video/*"} className="hidden" id={`block-file-${block.id}`} onChange={e => {
                                                    const f = e.target.files?.[0];
                                                    if (f) setNewsBlocks(newsBlocks.map(b => b.id === block.id ? { ...b, file: f, preview: URL.createObjectURL(f) } : b));
                                                }} />
                                                {block.preview ? (
                                                    <div className="relative aspect-video rounded-xl bg-black overflow-hidden">
                                                        {block.type === 'video' ? <video src={block.preview} className="h-full w-full object-contain" controls /> : <NextImage src={block.preview} alt="" fill className="object-cover" />}
                                                    </div>
                                                ) : (
                                                    <Button variant="outline" className="w-full h-24 rounded-xl border-dashed" onClick={() => document.getElementById(`block-file-${block.id}`)?.click()}>
                                                        <Plus className="h-4 w-4 mr-2" /> Upload {block.type}
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => addNewsBlock('text')} className="rounded-full px-4 text-[10px] font-black uppercase tracking-widest"><Type className="mr-2 h-3.5 w-3.5" /> Text</Button>
                                <Button variant="outline" size="sm" onClick={() => addNewsBlock('image')} className="rounded-full px-4 text-[10px] font-black uppercase tracking-widest"><LucideImage className="mr-2 h-3.5 w-3.5" /> Image</Button>
                                <Button variant="outline" size="sm" onClick={() => addNewsBlock('video')} className="rounded-full px-4 text-[10px] font-black uppercase tracking-widest"><Video className="mr-2 h-3.5 w-3.5" /> Video</Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-8 bg-muted/10 border-t">
                        <DialogClose asChild><Button variant="outline" className="rounded-xl">Cancel</Button></DialogClose>
                        <Button onClick={handleCreateNews} disabled={isActionLoading === 'creating-news'} className="rounded-xl font-black bg-primary px-12">
                            {isActionLoading === 'creating-news' ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Publish Modular Story
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Menu Creation/Editing Dialog */}
            <Dialog open={isMenuDialogOpen} onOpenChange={(o) => { if(!o) { setMenuToEdit(null); setMenuCafeteria(''); setMenuNote(''); setBreakfastItems([{name:'', price:''}]); setLunchItems([{name:'', price:''}]); } setIsMenuDialogOpen(o); }}>
                <DialogContent className="max-w-2xl rounded-[2.5rem] p-0 overflow-hidden">
                    <DialogHeader className="p-8 pb-4 bg-accent/5">
                        <DialogTitle className="text-3xl font-black">{menuToEdit ? 'Update Dining Menu' : 'Populate New Menu'}</DialogTitle>
                        <DialogDescription className="font-medium">Populate both breakfast and lunch for the day.</DialogDescription>
                    </DialogHeader>
                    
                    <ScrollArea className="max-h-[60vh] p-8 pt-4">
                        <div className="space-y-8">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Cafeteria Name</Label>
                                <Input value={menuCafeteria} onChange={e => setMenuCafeteria(e.target.value)} placeholder="e.g. Guild Canteen" className="rounded-xl h-14 bg-muted/20 border-none font-bold text-lg" />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                                    <StickyNote className="h-3 w-3" /> Cafeteria Note (Visible to students)
                                </Label>
                                <Textarea value={menuNote} onChange={e => setMenuNote(e.target.value)} placeholder="e.g. Special offer on Fish today!" className="rounded-xl min-h-[80px] bg-muted/20 border-none font-medium" />
                            </div>

                            <Separator />

                            {/* Breakfast Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-accent font-black text-sm uppercase tracking-widest">
                                        <Coffee className="h-4 w-4" /> Breakfast Section
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => setBreakfastItems([...breakfastItems, {name: '', price: ''}])} className="rounded-full h-8 text-[10px] font-black uppercase">Add Item</Button>
                                </div>
                                <div className="space-y-2">
                                    {breakfastItems.map((item, idx) => (
                                        <div key={idx} className="flex gap-2 animate-in slide-in-from-left-2 duration-300">
                                            <Input value={item.name} onChange={e => {
                                                const newItems = [...breakfastItems];
                                                newItems[idx].name = e.target.value;
                                                setBreakfastItems(newItems);
                                            }} placeholder="e.g. Katogo" className="rounded-xl h-12 flex-1" />
                                            <Input value={item.price} onChange={e => {
                                                const newItems = [...breakfastItems];
                                                newItems[idx].price = e.target.value;
                                                setBreakfastItems(newItems);
                                            }} placeholder="Price" className="rounded-xl h-12 w-28" />
                                            {breakfastItems.length > 1 && (
                                                <Button variant="ghost" size="icon" onClick={() => setBreakfastItems(breakfastItems.filter((_, i) => i !== idx))} className="h-12 w-12 text-destructive">
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Lunch Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-primary font-black text-sm uppercase tracking-widest">
                                        <UtensilsCrossed className="h-4 w-4" /> Lunch Section
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => setLunchItems([...lunchItems, {name: '', price: ''}])} className="rounded-full h-8 text-[10px] font-black uppercase">Add Item</Button>
                                </div>
                                <div className="space-y-2">
                                    {lunchItems.map((item, idx) => (
                                        <div key={idx} className="flex gap-2 animate-in slide-in-from-left-2 duration-300">
                                            <Input value={item.name} onChange={e => {
                                                const newItems = [...lunchItems];
                                                newItems[idx].name = e.target.value;
                                                setLunchItems(newItems);
                                            }} placeholder="e.g. Rice & Beans" className="rounded-xl h-12 flex-1" />
                                            <Input value={item.price} onChange={e => {
                                                const newItems = [...lunchItems];
                                                newItems[idx].price = e.target.value;
                                                setLunchItems(newItems);
                                            }} placeholder="Price" className="rounded-xl h-12 w-28" />
                                            {lunchItems.length > 1 && (
                                                <Button variant="ghost" size="icon" onClick={() => setLunchItems(lunchItems.filter((_, i) => i !== idx))} className="h-12 w-12 text-destructive">
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="p-8 pt-4 bg-muted/10 border-t">
                        <DialogClose asChild><Button variant="outline" className="rounded-xl h-12">Cancel</Button></DialogClose>
                        <Button onClick={handleCreateMenu} disabled={isActionLoading === 'creating-menu'} className="rounded-xl font-black bg-accent px-12 h-12 shadow-lg shadow-accent/20">
                            {isActionLoading === 'creating-menu' ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-4 w-4 mr-2" />}
                            {menuToEdit ? 'Update Live Menu' : 'Publish Daily Menu'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black font-headline tracking-tighter text-primary">Command Center</h1>
                    <p className="text-muted-foreground font-medium text-sm">Ultimate administrative authority over Makerere network.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild className="rounded-full h-10 px-6 font-bold border-primary/20">
                        <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" /> Firebase Console
                        </a>
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2">
                {[
                    { label: 'Students', val: stats.users, icon: User },
                    { label: 'News', val: stats.news, icon: Newspaper },
                    { label: 'Gigs', val: stats.gigs, icon: Briefcase },
                    { label: 'Menus', val: stats.menus, icon: UtensilsCrossed },
                    { label: 'Lost/Found', val: stats.lostFound, icon: HelpCircle },
                    { label: 'Curia', val: stats.curia, icon: Landmark },
                    { label: 'Feed', val: stats.posts, icon: MessageSquare },
                    { label: 'Mart', val: stats.listings, icon: ShoppingBag },
                    { label: 'Flags', val: stats.reports, icon: Flag, danger: stats.reports > 0 }
                ].map((s, i) => (
                    <Card key={i} className={cn("border-none shadow-none rounded-2xl transition-all hover:scale-105", s.danger ? "bg-destructive/10" : "bg-primary/5")}>
                        <CardContent className="p-3 flex flex-col items-center justify-center text-center space-y-1">
                            <s.icon className={cn("h-4 w-4 mb-0.5", s.danger ? "text-destructive" : "text-primary")} />
                            <p className="text-xl font-black leading-none">{s.val}</p>
                            <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-widest">{s.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="flex items-center gap-4 py-2 border-b">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full md:w-[320px] justify-between font-black text-xs uppercase tracking-widest h-14 rounded-2xl border-primary/20 bg-card shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <LayoutDashboard className="h-4 w-4 text-primary" />
                                </div>
                                <span className="text-primary truncate">Section: {activeTabLabel}</span>
                            </div>
                            <ChevronDown className="h-4 w-4 opacity-50 text-primary shrink-0" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[320px] rounded-2xl p-1 shadow-2xl">
                        {SECTIONS.map((section) => (
                            <DropdownMenuItem 
                                key={section.value} 
                                onClick={() => setActiveTab(section.value)}
                                className={cn(
                                    "flex items-center gap-3 p-4 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer transition-all",
                                    activeTab === section.value ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                )}
                            >
                                <section.icon className={cn("h-5 w-5", activeTab === section.value ? "text-primary-foreground" : "text-primary")} />
                                {section.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsContent value="moderation" className="space-y-4 outline-none">
                    {reports.length === 0 ? (
                        <Card className="border-dashed py-24 text-center text-muted-foreground bg-primary/5 border-primary/20 rounded-3xl">
                            <CheckCircle className="mx-auto h-16 w-16 mb-4 opacity-20 text-primary" />
                            <h3 className="text-xl font-black text-primary">Community is Clean</h3>
                            <p className="font-medium">No active reports in the moderation queue.</p>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {reports.map((report) => (
                                <Card key={report.id} className="overflow-hidden rounded-2xl border-none shadow-sm">
                                    <div className="bg-muted/30 p-4 flex items-center justify-between border-b text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        <div className="flex items-center gap-4">
                                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">{report.type}</span>
                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDistanceToNow(report.timestamp?.toDate() || new Date())} ago</span>
                                            <span className="flex items-center gap-1"><User className="h-3 w-3" /> Reported By: {report.reporterId.substring(0,6)}...</span>
                                        </div>
                                    </div>
                                    <CardContent className="p-5">
                                        <p className="text-sm font-medium mb-6 italic text-muted-foreground border-l-4 border-primary/20 pl-4 py-1 leading-relaxed">"{report.content.substring(0, 500)}..."</p>
                                        <div className="flex gap-3">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" className="rounded-xl font-bold px-6"><Trash2 className="mr-2 h-4 w-4" />Nuke Content</Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="rounded-3xl">
                                                    <AlertDialogHeader><AlertDialogTitle className="text-2xl font-black font-headline">Confirm Erasure</AlertDialogTitle><AlertDialogDescription>This will permanently remove the content and all its interactions.</AlertDialogDescription></AlertDialogHeader>
                                                    <div className="py-6 space-y-2">
                                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Type confirmation word below</Label>
                                                        <Input placeholder="DELETE" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="h-14 text-center font-black text-xl tracking-widest uppercase border-destructive/20 focus-visible:ring-destructive" />
                                                    </div>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel onClick={() => setDeleteConfirm('')} className="rounded-xl">Keep Content</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteContent(report.type, report.entityId)} disabled={deleteConfirm !== 'DELETE'} className="bg-destructive hover:bg-destructive/90 text-white rounded-xl px-8 font-bold h-12">Confirm Deletion</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                            <Button variant="outline" className="rounded-xl font-bold" onClick={() => deleteDoc(doc(db, 'reports', report.id))}>Dismiss Report</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="students" className="space-y-4 outline-none">
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search directory by name, username, ID, or registration..." 
                            value={userSearchTerm}
                            onChange={(e) => setUserSearchTerm(e.target.value)}
                            className="pl-10 h-12 rounded-xl bg-card border-primary/10 focus-visible:ring-primary"
                        />
                    </div>
                    <Card className="rounded-2xl overflow-hidden border-none shadow-sm">
                        <CardContent className="p-0">
                            <div className="divide-y divide-primary/5">
                                {filteredUserList.map((u) => {
                                    const isSuspended = !!u.suspended && u.suspendsUntil?.toDate() > new Date();
                                    return (
                                        <div key={u.uid} className={cn("flex items-center justify-between p-5 hover:bg-muted/30 transition-colors gap-4", isSuspended && "bg-destructive/5")}>
                                            <div className="flex items-center gap-4">
                                                <Avatar className="h-12 w-12 border-2 border-primary/10">
                                                    <AvatarImage src={u.avatar} />
                                                    <AvatarFallback className="font-bold">{u.name?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-black text-md leading-none">{u.name}</p>
                                                        {u.isVerified === true && <BadgeCheck className="h-4 w-4 fill-blue-500 text-white" />}
                                                        {u.isGreen === true && <BadgeCheck className="h-4 w-4 fill-green-500 text-white" />}
                                                        {isSuspended && <span className="text-[10px] bg-destructive text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Suspended</span>}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground font-medium">@{u.username} {isSuspended && `• Blocked until ${format(u.suspendsUntil.toDate(), 'MMM d, h:mm a')}`}</p>
                                                    <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-primary/60">
                                                        <span className="flex items-center gap-1"><Hash className="h-2.5 w-2.5" /> ID: {u.studentNumber || 'N/A'}</span>
                                                        <span className="flex items-center gap-1"><Fingerprint className="h-2.5 w-2.5" /> REG: {u.registrationNumber || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col items-center gap-1 mr-2">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-500">Blue</span>
                                                    <Switch 
                                                        checked={u.isVerified === true} 
                                                        onCheckedChange={() => handleToggleVerification(u.uid, u.isVerified === true)}
                                                        disabled={isActionLoading === u.uid + '-verify'}
                                                    />
                                                </div>
                                                <div className="flex flex-col items-center gap-1 mr-4">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-green-500">Green</span>
                                                    <Switch 
                                                        checked={u.isGreen === true} 
                                                        onCheckedChange={() => handleToggleGreenBadge(u.uid, u.isGreen === true)}
                                                        disabled={isActionLoading === u.uid + '-green'}
                                                    />
                                                </div>
                                                <div className="flex flex-col items-center gap-1 mr-4">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">News</span>
                                                    <Switch 
                                                        checked={!!u.canPostNews} 
                                                        onCheckedChange={() => handleToggleNewsPermission(u.uid, !!u.canPostNews)}
                                                        disabled={isActionLoading === u.uid}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isSuspended ? (
                                                        <Button variant="ghost" size="sm" onClick={() => handleLiftSuspension(u.uid)} disabled={isActionLoading === u.uid} className="text-green-600 hover:bg-green-50 font-bold uppercase text-[10px] tracking-widest h-9 rounded-xl">
                                                            <Unlock className="h-4 w-4 mr-2" /> Restore
                                                        </Button>
                                                    ) : (
                                                        <Button variant="ghost" size="sm" onClick={() => setSelectedUserForSuspension(u)} disabled={isActionLoading === u.uid} className="text-orange-600 hover:bg-orange-50 font-bold uppercase text-[10px] tracking-widest h-9 rounded-xl">
                                                            <Ban className="h-4 w-4 mr-2" /> Block
                                                        </Button>
                                                    )}
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="text-destructive h-9 w-9 hover:bg-destructive/10 rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="rounded-3xl">
                                                            <AlertDialogHeader><AlertDialogTitle className="text-2xl font-black font-headline">Nuke Student Profile</AlertDialogTitle><AlertDialogDescription>This removes @{u.username} and all their feed posts forever. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                            <div className="py-6 space-y-2">
                                                                <Label className="text-xs font-bold uppercase text-muted-foreground">Type confirmation word below</Label>
                                                                <Input placeholder="DELETE" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="h-14 text-center font-black text-xl tracking-widest uppercase border-destructive/20" />
                                                            </div>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel onClick={() => setDeleteConfirm('')} className="rounded-xl">Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteUser(u.uid)} disabled={deleteConfirm !== 'DELETE'} className="bg-destructive text-white rounded-xl h-12 font-bold px-8">Permanently Erase Student</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredUserList.length === 0 && (
                                    <div className="p-20 text-center text-muted-foreground">
                                        <p className="font-bold italic">No students found matching your search.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="content" className="space-y-6 outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Feed Posts */}
                        <Card className="rounded-[2rem] border-none shadow-sm flex flex-col max-h-[600px]">
                            <CardHeader className="border-b bg-muted/10 rounded-t-[2rem]">
                                <CardTitle className="text-xl font-black flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /> Main Feed</CardTitle>
                                <CardDescription>Latest 100 public posts from campus.</CardDescription>
                            </CardHeader>
                            <ScrollArea className="flex-1">
                                <div className="divide-y divide-primary/5">
                                    {allPosts.map((post) => (
                                        <div key={post.id} className="p-4 space-y-2 hover:bg-muted/30 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6"><AvatarImage src={post.user?.avatar} /><AvatarFallback>{post.user?.name?.charAt(0)}</AvatarFallback></Avatar>
                                                    <span className="text-xs font-bold">@{post.user?.username}</span>
                                                </div>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                                                    <AlertDialogContent className="rounded-[2rem]">
                                                        <AlertDialogHeader><AlertDialogTitle>Delete Feed Post?</AlertDialogTitle></AlertDialogHeader>
                                                        <div className="py-4"><Input placeholder="DELETE" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} className="h-12 rounded-xl text-center font-black" /></div>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel onClick={() => setDeleteConfirm('')}>Keep</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteContent('post', post.id)} disabled={deleteConfirm !== 'DELETE'} className="bg-destructive">Nuke</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                            <p className="text-xs line-clamp-2 text-muted-foreground">{post.content}</p>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </Card>

                        {/* Curia Posts */}
                        <Card className="rounded-[2rem] border-none shadow-sm flex flex-col max-h-[600px]">
                            <CardHeader className="border-b bg-muted/10 rounded-t-[2rem]">
                                <CardTitle className="text-xl font-black flex items-center gap-2"><Landmark className="h-5 w-5 text-accent" /> The Curia Feed</CardTitle>
                                <CardDescription>Current active anonymous session posts.</CardDescription>
                            </CardHeader>
                            <ScrollArea className="flex-1">
                                <div className="divide-y divide-primary/5">
                                    {curiaPosts.map((post) => (
                                        <div key={post.id} className="p-4 space-y-2 hover:bg-muted/30 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 rounded-full bg-accent/10 flex items-center justify-center"><User className="h-3 w-3 text-accent" /></div>
                                                    <span className="text-[10px] font-black uppercase text-accent">{post.user?.name}</span>
                                                </div>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                                                    <AlertDialogContent className="rounded-[2rem]">
                                                        <AlertDialogHeader><AlertDialogTitle>Erase Anonymous Post?</AlertDialogTitle></AlertDialogHeader>
                                                        <div className="py-4"><Input placeholder="DELETE" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} className="h-12 rounded-xl text-center font-black" /></div>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel onClick={() => setDeleteConfirm('')}>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteContent('curia', post.id)} disabled={deleteConfirm !== 'DELETE'} className="bg-destructive">Erase</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                            <p className="text-xs line-clamp-2 text-muted-foreground">{post.content}</p>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="alllistings" className="space-y-4 outline-none">
                    <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/10 border-b">
                            <CardTitle className="text-xl font-black">All MakMart Listings</CardTitle>
                            <CardDescription>Comprehensive list of every item listed on the marketplace.</CardDescription>
                        </CardHeader>
                        <div className="divide-y divide-primary/5">
                            {allListings.map((item) => (
                                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-muted overflow-hidden relative">
                                            {item.imageUrls?.[0] ? <NextImage src={item.imageUrls[0]} alt="" fill className="object-cover" /> : <ShoppingBag className="m-auto h-6 w-6 opacity-20" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm leading-none">{item.title}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded">{item.category}</span>
                                                <span className="text-[9px] font-bold text-muted-foreground">Seller: @{item.user?.username}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-5 w-5" /></Button></AlertDialogTrigger>
                                        <AlertDialogContent className="rounded-[2rem]">
                                            <AlertDialogHeader><AlertDialogTitle>Remove Item Forever?</AlertDialogTitle></AlertDialogHeader>
                                            <div className="py-4"><Input placeholder="DELETE" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} className="h-12 rounded-xl text-center font-black" /></div>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel onClick={() => setDeleteConfirm('')}>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteContent('listing', item.id)} disabled={deleteConfirm !== 'DELETE'} className="bg-destructive">Nuke Item</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            ))}
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="news" className="space-y-4 outline-none">
                    <div className="flex justify-between items-center mb-6">
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Campus Stories</p>
                        <Button onClick={() => setIsNewsDialogOpen(true)} className="rounded-xl font-bold bg-primary">
                            <Plus className="h-4 w-4 mr-2" /> Write Modular Story
                        </Button>
                    </div>
                    <div className="grid gap-4">
                        {newsItems.map((item) => (
                            <Card key={item.id} className="p-4 flex gap-5 rounded-2xl border-none shadow-sm hover:shadow-md transition-all">
                                <Avatar className="h-20 w-20 rounded-2xl shrink-0 overflow-hidden border-2 border-primary/5 bg-black">
                                    {item.mediaURL ? (
                                        item.mediaType === 'video' ? (
                                            <div className="h-full w-full flex items-center justify-center">
                                                <Video className="h-8 w-8 text-white opacity-40" />
                                            </div>
                                        ) : (
                                            <AvatarImage src={item.mediaURL} className="object-cover" />
                                        )
                                    ) : (
                                        <AvatarFallback className="rounded-2xl bg-primary/5">
                                            <Newspaper className="h-8 w-8 text-primary opacity-20" />
                                        </AvatarFallback>
                                    )}
                                </Avatar>
                                <div className="flex-1 space-y-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">{item.category}</p>
                                            <p className="text-sm font-black tracking-tight">{item.title}</p>
                                        </div>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-3xl">
                                                <AlertDialogHeader><AlertDialogTitle className="font-headline text-2xl font-black">Delete News Story</AlertDialogTitle></AlertDialogHeader>
                                                <div className="py-6"><Input placeholder="DELETE" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="h-14 text-center font-black text-xl uppercase border-destructive/20" /></div>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel onClick={() => setDeleteConfirm('')}>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteContent('news', item.id)} disabled={deleteConfirm !== 'DELETE'} className="bg-destructive text-white rounded-xl h-12">Nuke Story</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Author: {item.author}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Posted: {item.timestamp ? format(item.timestamp.toDate(), 'MMM d, h:mm a') : 'Now'}</p>
                                </div>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="menus" className="space-y-4 outline-none">
                    <div className="flex justify-between items-center mb-6">
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Live Cafeteria Menus</p>
                        <Button onClick={() => setIsMenuDialogOpen(true)} className="rounded-xl font-bold bg-accent">
                            <Plus className="h-4 w-4 mr-2" /> Add New Menu
                        </Button>
                    </div>
                    <div className="grid gap-4">
                        {cafeteriaMenus.map((menu) => (
                            <Card key={menu.id} className="p-4 flex gap-5 rounded-2xl border-none shadow-sm hover:shadow-md transition-all">
                                <div className="h-16 w-16 rounded-2xl shrink-0 bg-accent/10 flex items-center justify-center">
                                    <UtensilsCrossed className="h-8 w-8 text-accent opacity-40" />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-accent">Daily Menu</p>
                                            <p className="text-sm font-black tracking-tight">{menu.cafeteriaName}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEditMenu(menu)} className="h-8 w-8 rounded-full">
                                                <Edit3 className="h-4 w-4 text-accent" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive h-8 w-8 rounded-full"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                <AlertDialogContent className="rounded-3xl">
                                                    <AlertDialogHeader><AlertDialogTitle className="font-headline text-2xl font-black">Delete Menu</AlertDialogTitle></AlertDialogHeader>
                                                    <div className="py-6"><Input placeholder="DELETE" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="h-14 text-center font-black text-xl uppercase border-destructive/20" /></div>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel onClick={() => setDeleteConfirm('')}>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteContent('menu', menu.id)} disabled={deleteConfirm !== 'DELETE'} className="bg-destructive text-white rounded-xl h-12">Nuke Menu</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        Sections: {(menu.breakfastItems?.length > 0 ? "Breakfast " : "") + (menu.lunchItems?.length > 0 ? "Lunch" : "")}
                                    </p>
                                </div>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="gigboard" className="space-y-4 outline-none">
                    <div className="flex justify-between items-center mb-6">
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Active Gig Requests</p>
                        <Select value={adminGigCategory} onValueChange={setAdminGigCategory}>
                            <SelectTrigger className="w-64 h-10 rounded-xl bg-card">
                                <div className="flex items-center gap-2">
                                    <Filter className="h-3.5 w-3.5 text-primary" />
                                    <SelectValue placeholder="Filter by Category" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all" className="text-[10px] font-bold uppercase">All Gigs</SelectItem>
                                <SelectItem value="academic" className="text-[10px] font-bold uppercase">Academic Help</SelectItem>
                                <SelectItem value="tutoring" className="text-[10px] font-bold uppercase">Tutoring</SelectItem>
                                <SelectItem value="errands" className="text-[10px] font-bold uppercase">Campus Errands</SelectItem>
                                <SelectItem value="delivery" className="text-[10px] font-bold uppercase">Delivery</SelectItem>
                                <SelectItem value="tech" className="text-[10px] font-bold uppercase">Tech Support</SelectItem>
                                <SelectItem value="creative" className="text-[10px] font-bold uppercase">Creative/Design</SelectItem>
                                <SelectItem value="photography" className="text-[10px] font-bold uppercase">Photography/Video</SelectItem>
                                <SelectItem value="fashion" className="text-[10px] font-bold uppercase">Fashion & Beauty</SelectItem>
                                <SelectItem value="events" className="text-[10px] font-bold uppercase">Events & Hosting</SelectItem>
                                <SelectItem value="marketing" className="text-[10px] font-bold uppercase">Marketing</SelectItem>
                                <SelectItem value="manual" className="text-[10px] font-bold uppercase">Manual/Cleaning</SelectItem>
                                <SelectItem value="research" className="text-[10px] font-bold uppercase">Research</SelectItem>
                                <SelectItem value="other" className="text-[10px] font-bold uppercase">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-4">
                        {filteredGigs.map((gig) => (
                            <Card key={gig.id} className="p-4 flex gap-5 rounded-2xl border-none shadow-sm hover:shadow-md transition-all">
                                <Avatar className="h-16 w-16 rounded-2xl shrink-0 overflow-hidden border-2 border-primary/5">
                                    <AvatarImage src={gig.user?.avatar} />
                                    <AvatarFallback className="rounded-2xl bg-accent/5">
                                        <Briefcase className="h-8 w-8 text-accent opacity-20" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-accent">{gig.category}</p>
                                            <p className="text-sm font-black tracking-tight">{gig.title}</p>
                                        </div>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-3xl">
                                                <AlertDialogHeader><AlertDialogTitle className="font-headline text-2xl font-black">Delete Gig Request</AlertDialogTitle></AlertDialogHeader>
                                                <div className="py-6"><Input placeholder="DELETE" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="h-14 text-center font-black text-xl uppercase border-destructive/20" /></div>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel onClick={() => setDeleteConfirm('')} className="rounded-xl">Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteContent('gig', gig.id)} disabled={deleteConfirm !== 'DELETE'} className="bg-destructive text-white rounded-xl h-12">Nuke Gig</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Budget: {gig.budget}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Client: @{gig.user?.username}</p>
                                </div>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="broadcast" className="space-y-6 outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="border-accent/20 bg-card rounded-3xl shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-2xl font-black text-accent flex items-center gap-3"><Zap className="h-6 w-6"/> Custom Broadcast</CardTitle>
                                <CardDescription>Send a manual push notification to all students.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notification Title</Label>
                                        <Input 
                                            value={broadcastTitle} 
                                            onChange={e => setBroadcastTitle(e.target.value)} 
                                            placeholder="e.g. 🌙 The Curia is now Open!" 
                                            className="h-12 rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notification Body</Label>
                                        <Textarea 
                                            value={broadcastBody} 
                                            onChange={e => setBroadcastBody(e.target.value)} 
                                            placeholder="e.g. Join the anonymous talk tonight." 
                                            className="min-h-[100px] rounded-2xl p-4"
                                        />
                                    </div>
                                </div>
                                <Button 
                                    onClick={() => handleBroadcastPush()} 
                                    disabled={isBroadcasting || !broadcastTitle.trim() || !broadcastBody.trim()}
                                    className="w-full h-14 rounded-2xl font-black text-lg bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20"
                                >
                                    {isBroadcasting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                                    Send Custom Broadcast
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="border-primary/20 bg-card rounded-3xl shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-2xl font-black text-primary flex items-center gap-3"><Sparkles className="h-6 w-6"/> Quick Triggers</CardTitle>
                                <CardDescription>One-tap common campus notifications.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button 
                                    variant="outline" 
                                    className="w-full h-20 justify-start gap-4 rounded-2xl border-primary/20 hover:bg-primary/5"
                                    onClick={() => handleBroadcastPush("🌙 The Curia is now OPEN!", "The anonymous session has started. Join the talk before 1 AM.")}
                                    disabled={isBroadcasting}
                                >
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><Landmark /></div>
                                    <div className="text-left"><p className="font-black text-sm">Open The Curia</p><p className="text-[10px] text-muted-foreground">Notify students about the anonymous session.</p></div>
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="w-full h-20 justify-start gap-4 rounded-2xl border-accent/20 hover:bg-accent/5"
                                    onClick={() => handleBroadcastPush("🚨 Official Campus Alert", "Check MakNews for an urgent administrative update.")}
                                    disabled={isBroadcasting}
                                >
                                    <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent"><Megaphone /></div>
                                    <div className="text-left"><p className="font-black text-sm">Urgent Campus Alert</p><p className="text-[10px] text-muted-foreground">Direct everyone to the MakNews section.</p></div>
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="config" className="space-y-6 outline-none">
                    <Card className="border-primary/20 bg-card rounded-3xl shadow-sm">
                        <CardHeader><CardTitle className="text-xl font-black text-primary flex items-center gap-3"><Construction className="h-6 w-6"/> System Controls</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-primary/5">
                                <Label className="flex flex-col gap-1">
                                    <span className="text-lg font-black tracking-tight">Maintenance Mode</span>
                                    <span className="font-medium text-xs text-muted-foreground">Locks regular students out for upgrades.</span>
                                </Label>
                                <Switch checked={appSettings.maintenanceMode} onCheckedChange={(val) => handleUpdateSettings({ maintenanceMode: val })} />
                            </div>
                            <Separator className="bg-primary/5" />
                            <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-primary/5">
                                <Label className="flex flex-col gap-1">
                                    <span className="text-lg font-black tracking-tight">Force Open Curia</span>
                                    <span className="font-medium text-xs text-muted-foreground">Bypass standard 8pm-1am session lock.</span>
                                </Label>
                                <Switch checked={appSettings.manualCuriaOpen} onCheckedChange={(val) => handleUpdateSettings({ manualCuriaOpen: val })} />
                            </div>
                            <Separator className="bg-primary/5" />
                            <div className="p-4 bg-muted/20 rounded-2xl border border-primary/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label className="flex flex-col gap-1">
                                        <span className="text-lg font-black tracking-tight flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Campus Announcement</span>
                                        <span className="font-medium text-xs text-muted-foreground">Appears at the top of every student's feed.</span>
                                    </Label>
                                    <Switch checked={appSettings.announcementActive} onCheckedChange={(val) => handleUpdateSettings({ announcementActive: val })} />
                                </div>
                                <div className="space-y-2">
                                    <Textarea 
                                        value={appSettings.announcement} 
                                        onChange={e => setAppSettings(prev => ({ ...prev, announcement: e.target.value }))}
                                        placeholder="e.g. Exams scheduled for October are now postponed to November."
                                        className="min-h-[80px] rounded-xl bg-card border-primary/10"
                                    />
                                    <Button size="sm" onClick={() => handleUpdateSettings({ announcement: appSettings.announcement })} className="h-8 rounded-lg text-[10px] font-black uppercase">Update Text</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="lostfound" className="space-y-4 outline-none">
                    <div className="grid gap-4">
                        {lostFoundItems.map((item) => (
                            <Card key={item.id} className="p-4 flex gap-5 rounded-2xl border-none shadow-sm hover:shadow-md transition-all">
                                <Avatar className="h-20 w-20 rounded-2xl shrink-0 overflow-hidden border-2 border-primary/5">
                                    <AvatarImage src={item.imageURL} />
                                    <AvatarFallback className="rounded-2xl bg-primary/5">
                                        <HelpCircle className="h-8 w-8 text-primary opacity-20" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">{item.type}</p>
                                            <p className="text-sm font-black tracking-tight">{item.title}</p>
                                        </div>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-3xl">
                                                <AlertDialogHeader><AlertDialogTitle className="font-headline text-2xl font-black">Delete LF Report</AlertDialogTitle></AlertDialogHeader>
                                                <div className="py-6"><Input placeholder="DELETE" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="h-14 text-center font-black text-xl uppercase border-destructive/20" /></div>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel onClick={() => setDeleteConfirm('')} className="rounded-xl">Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteContent('lostfound', item.id)} disabled={deleteConfirm !== 'DELETE'} className="bg-destructive text-white rounded-xl h-12">Nuke Report</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Location: {item.location}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Reporter: @{item.user?.username}</p>
                                </div>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
