"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, where, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Search, X, MessageCircle, Building, ShoppingCart, Wrench, Edit, Trash2, MoreHorizontal, Flag, Plus, Image as ImageIcon, Store, Package, MapPin, ChevronRight, CheckCircle2, ArrowLeft } from 'lucide-react';
import NextImage from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type ListingCategory = 'sale' | 'lease' | 'service';

type Listing = {
    id: string;
    title: string;
    description: string;
    price?: number;
    category: ListingCategory;
    imageUrls?: string[];
    user: {
        uid: string;
        name: string;
        username: string;
        avatar: string;
        shopName?: string;
    };
    timestamp: any;
    condition?: 'new' | 'just-new' | 'used-like-new' | 'used-good' | 'used-fair';
    location?: string;
    rate?: string;
};

const CreateListingDialog = ({
  open,
  onOpenChange,
  category,
  listingToEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ListingCategory | null;
  listingToEdit?: Listing | null;
}) => {
    const [user] = useAuthState(auth);
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const [condition, setCondition] = useState<Listing['condition']>();
    const [location, setLocation] = useState('');
    const [rate, setRate] = useState('');
    
    useEffect(() => {
        if (open) {
            if (listingToEdit) {
                setTitle(listingToEdit.title);
                setDescription(listingToEdit.description);
                setPrice(listingToEdit.price?.toString() || '');
                setExistingImageUrls(listingToEdit.imageUrls || []);
                setCondition(listingToEdit.condition);
                setLocation(listingToEdit.location || '');
                setRate(listingToEdit.rate || '');
                setImageFiles([]);
                setImagePreviews([]);
            } else {
                resetForm();
            }
        }
    }, [open, listingToEdit]);

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setPrice('');
        setImageFiles([]);
        setImagePreviews([]);
        setExistingImageUrls([]);
        setCondition(undefined);
        setLocation('');
        setRate('');
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length + imageFiles.length + existingImageUrls.length > 5) {
            toast({ variant: 'destructive', title: 'Limit Reached', description: 'You can upload up to 5 images per listing.' });
            return;
        }

        const newPreviews = files.map(file => URL.createObjectURL(file));
        setImageFiles(prev => [...prev, ...files]);
        setImagePreviews(prev => [...prev, ...newPreviews]);
        
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const removeNewImage = (index: number) => {
        setImageFiles(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingImage = (index: number) => {
        setExistingImageUrls(prev => prev.filter((_, i) => i !== index));
    };
    
    const handleSave = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in.' });
            return;
        }
        if (!category || !title) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please fill out all required fields.' });
            return;
        }

        if (imageFiles.length === 0 && existingImageUrls.length === 0 && category !== 'service') {
            toast({ variant: 'destructive', title: 'Images Required', description: 'Please add at least one image for your listing.' });
            return;
        }
        
        setIsSaving(true);
        try {
            const uploadedUrls: string[] = [...existingImageUrls];
            
            for (const file of imageFiles) {
                const imageRef = ref(storage, `mak-mart/${user.uid}/${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(imageRef, file);
                const url = await getDownloadURL(snapshot.ref);
                uploadedUrls.push(url);
            }

            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists()) throw new Error("User profile not found.");
            const userData = userDoc.data();

            const listingData: any = {
                title,
                description,
                category,
                user: {
                    uid: user.uid,
                    name: userData.name,
                    username: userData.username,
                    avatar: userData.avatar,
                    shopName: userData.shopName || '',
                },
                location,
                imageUrls: uploadedUrls,
            };

            if (category === 'sale') {
                listingData.price = parseFloat(price);
                listingData.condition = condition;
            } else if (category === 'lease') {
                listingData.price = parseFloat(price);
                listingData.rate = rate;
            } else if (category === 'service') {
                listingData.rate = rate;
            }
            
            if (listingToEdit) {
                await updateDoc(doc(db, 'mak-mart-listings', listingToEdit.id), listingData);
                toast({ title: 'Listing Updated!', description: `"${title}" has been successfully updated.` });
            } else {
                listingData.timestamp = serverTimestamp();
                await addDoc(collection(db, 'mak-mart-listings'), listingData);
                toast({ title: 'Listing Created!', description: `"${title}" is now live on MakMart.` });
            }

            onOpenChange(false);
        } catch (error) {
            console.error("Error saving listing:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save listing. Please try again.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (!category) return null;

    const dialogDetails = {
        sale: { title: 'Sell an Item', description: 'List an item for sale on the marketplace.' },
        lease: { title: 'Lease an Item', description: 'List an item for rent, like clothing, electronics, etc.' },
        service: { title: 'Offer a Service', description: 'Let people know about a service you offer.' },
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle>{listingToEdit ? 'Edit Listing' : 'Create a New Listing'}</DialogTitle>
                    <DialogDescription>{dialogDetails[category].description}</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Item Name</Label>
                            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. MacBook Pro M1, Gown for Rent" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Details</Label>
                            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your item or service..." className="min-h-[100px]" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {category !== 'service' && (
                                <div className="space-y-2">
                                    <Label htmlFor="price">{category === 'sale' ? 'Price (UGX)' : 'Rent/Price'}</Label>
                                    <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="50,000" />
                                </div>
                            )}
                            {category === 'sale' && (
                                <div className="space-y-2">
                                    <Label htmlFor="condition">Condition</Label>
                                    <Select onValueChange={(v) => setCondition(v as Listing['condition'])} value={condition}>
                                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="new">New</SelectItem>
                                            <SelectItem value="just-new">Just New</SelectItem>
                                            <SelectItem value="used-like-new">Used - Like New</SelectItem>
                                            <SelectItem value="used-good">Used - Good</SelectItem>
                                            <SelectItem value="used-fair">Used - Fair</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            {(category === 'lease' || category === 'service') && (
                                <div className="space-y-2">
                                    <Label htmlFor="rate">Rate</Label>
                                    <Input id="rate" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. per day, per job" />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="location">Location</Label>
                                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Wandegeya, CIT" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label>Photos ({existingImageUrls.length + imageFiles.length}/5)</Label>
                            <div className="grid grid-cols-5 gap-2">
                                {existingImageUrls.map((url, idx) => (
                                    <div key={`existing-${idx}`} className="relative aspect-square rounded-lg overflow-hidden border bg-muted group">
                                        <NextImage src={url} alt="Listing" fill className="object-cover" />
                                        <button className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeExistingImage(idx)}><X className="h-3 w-3" /></button>
                                    </div>
                                ))}
                                {imagePreviews.map((url, idx) => (
                                    <div key={`new-${idx}`} className="relative aspect-square rounded-lg overflow-hidden border bg-muted group">
                                        <NextImage src={url} alt="New" fill className="object-cover" />
                                        <button className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeNewImage(idx)}><X className="h-3 w-3" /></button>
                                    </div>
                                ))}
                                {existingImageUrls.length + imageFiles.length < 5 && (
                                    <button 
                                        className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-muted transition-all active:scale-95"
                                        onClick={() => imageInputRef.current?.click()}
                                    >
                                        <Plus className="h-6 w-6 mb-1" />
                                        <span className="text-[10px] font-bold">ADD</span>
                                        <input type="file" accept="image/*" ref={imageInputRef} onChange={handleImageChange} className="hidden" multiple />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter className="p-6 pt-4 border-t bg-muted/20">
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleSave} disabled={isSaving} className="min-w-[120px]">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                        {isSaving ? 'Saving...' : 'List Item'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const ViewListingDialog = ({ open, onOpenChange, listing }: { open: boolean, onOpenChange: (open: boolean) => void, listing: Listing | null }) => {
    const [user] = useAuthState(auth);
    const router = useRouter();
    const { toast } = useToast();
    const [isStartingChat, setIsStartingChat] = useState(false);

    if (!listing) return null;

    const isOwner = user?.uid === listing.user.uid;
    const images = listing.imageUrls || [];

    const handleContact = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Login Required', description: 'Log in to contact sellers.'});
            return;
        }
        if (isOwner) {
            toast({ title: "This is your listing" });
            return;
        }

        setIsStartingChat(true);
        const conversationId = [user.uid, listing.user.uid].sort().join('_');
        const conversationRef = doc(db, 'conversations', conversationId);
        
        try {
            const docSnap = await getDoc(conversationRef);
            if (!docSnap.exists()) {
                const currentUserProfileSnap = await getDoc(doc(db, 'users', user.uid));
                const currentUserData = currentUserProfileSnap.data();
                if (!currentUserData) throw new Error("Profile not found");

                await setDoc(conversationRef, {
                    users: [user.uid, listing.user.uid],
                    userNames: { [user.uid]: currentUserData.name, [listing.user.uid]: listing.user.name },
                    userAvatars: { [user.uid]: currentUserData.avatar, [listing.user.uid]: listing.user.avatar },
                    userUsernames: { [user.uid]: currentUserData.username, [listing.user.uid]: listing.user.username },
                    lastMessage: `Inquiry about: ${listing.title}`, 
                    lastMessageTimestamp: serverTimestamp(), 
                    unreadCount: { [user.uid]: 0, [listing.user.uid]: 1 },
                });
                
                await addDoc(collection(conversationRef, 'messages'), {
                    senderId: 'system',
                    type: 'system',
                    text: `Started chat from MakMart: "${listing.title}"`,
                    timestamp: serverTimestamp(),
                });
            }
            router.push(`/messages?id=${conversationId}`);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not start chat." });
        } finally {
            setIsStartingChat(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl p-0 max-h-[95vh] flex flex-col overflow-hidden rounded-2xl">
                <DialogHeader className="sr-only">
                    <DialogTitle>{listing.title}</DialogTitle>
                    <DialogDescription>Viewing listing details for {listing.title}</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto relative">
                    {/* Explicit Floating Exit Button for Mobile/Touch UX */}
                    <DialogClose asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-4 left-4 z-50 rounded-full bg-black/30 hover:bg-black/50 text-white border-none backdrop-blur-md transition-all active:scale-90"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </DialogClose>

                    {images.length > 0 ? (
                        <div className="relative aspect-[4/3] bg-black w-full overflow-hidden">
                            <Carousel className="w-full h-full">
                                <CarouselContent className="m-0 h-full">
                                    {images.map((url, idx) => (
                                        <CarouselItem key={idx} className="p-0 h-full">
                                            <div className="relative w-full h-full">
                                                <NextImage 
                                                    src={url} 
                                                    alt={listing.title} 
                                                    fill 
                                                    className="object-contain" 
                                                    sizes="(max-width: 768px) 100vw, 800px"
                                                />
                                            </div>
                                        </CarouselItem>
                                    ))}
                                </CarouselContent>
                                {images.length > 1 && (
                                    <>
                                        <CarouselPrevious className="left-4 bg-white/20 hover:bg-white/40 border-none text-white z-10" />
                                        <CarouselNext className="right-4 bg-white/20 hover:bg-white/40 border-none text-white z-10" />
                                    </>
                                )}
                            </Carousel>
                        </div>
                    ) : (
                        <div className="aspect-video bg-muted flex items-center justify-center">
                            <Package className="h-20 w-20 text-muted-foreground opacity-20" />
                        </div>
                    )}

                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-bold font-headline leading-tight">{listing.title}</h2>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">{listing.category}</span>
                                        {listing.condition && <span className="text-xs font-bold uppercase bg-secondary px-2 py-0.5 rounded-full">{listing.condition.replace(/-/g, ' ')}</span>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-black text-primary">
                                        {listing.price?.toLocaleString('en-US', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })}
                                    </p>
                                    {listing.rate && <p className="text-xs font-bold text-muted-foreground uppercase">{listing.rate}</p>}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl">
                                <Store className="h-5 w-5 text-primary" />
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-tighter leading-none">Seller</p>
                                    <p className="font-bold">{listing.user.shopName || listing.user.name}</p>
                                </div>
                                <Button variant="ghost" size="sm" asChild>
                                    <a href={`/profile/${listing.user.username}`} className="text-xs font-bold">Visit Profile <ChevronRight className="h-3 w-3 ml-1"/></a>
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <h3 className="font-bold uppercase text-xs text-muted-foreground flex items-center gap-2"><CheckCircle2 className="h-3 w-3"/> Details</h3>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{listing.description}</p>
                            </div>

                            {listing.location && (
                                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground pt-4 border-t">
                                    <MapPin className="h-4 w-4 text-primary" />
                                    <span>Available at {listing.location}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t bg-background flex gap-3 sticky bottom-0">
                    <DialogClose asChild>
                        <Button variant="outline" className="h-12 rounded-xl px-6 font-bold max-sm:hidden">Close</Button>
                    </DialogClose>
                    <Button className="flex-1 h-12 rounded-xl text-md font-bold" onClick={handleContact} disabled={isStartingChat || isOwner}>
                        {isStartingChat ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <MessageCircle className="mr-2 h-5 w-5" />}
                        {isOwner ? "Manage Listing" : "Message Seller"}
                    </Button>
                    {!isOwner && (
                        <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl">
                            <Flag className="h-5 w-5 text-muted-foreground" />
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

const ListingCard = ({ listing, onClick }: { listing: Listing; onClick: () => void }) => {
    return (
        <Card className="flex flex-col h-full overflow-hidden border-none shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer bg-card group" onClick={onClick}>
            <div className="relative aspect-[1/1] w-full bg-muted">
                {listing.imageUrls?.[0] ? (
                    <NextImage src={listing.imageUrls[0]} alt={listing.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 50vw, 33vw" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-20">
                        <Package className="h-10 w-10" />
                    </div>
                )}
                {listing.category === 'lease' && <div className="absolute top-2 left-2 bg-accent text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm">FOR RENT</div>}
            </div>
            <CardContent className="p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase leading-none">{listing.user.shopName || "Private Seller"}</p>
                <h3 className="text-sm font-bold line-clamp-2 leading-tight h-10 group-hover:text-primary transition-colors">{listing.title}</h3>
                <div className="pt-1">
                    <p className="text-base font-black text-primary leading-none">
                        {listing.price ? listing.price.toLocaleString('en-US', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }) : listing.rate}
                    </p>
                    {listing.rate && listing.price && <p className="text-[10px] font-bold text-muted-foreground uppercase">{listing.rate}</p>}
                </div>
            </CardContent>
        </Card>
    );
};

export default function MakMartPage() {
    const [user, loadingAuth] = useAuthState(auth);
    const [listings, setListings] = useState<Listing[]>([]);
    const [loadingListings, setLoadingListings] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState<ListingCategory | null>(null);
    const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        localStorage.setItem('lastReadMakMart', Date.now().toString());
    }, []);

    useEffect(() => {
        setLoadingListings(true);
        const q = query(collection(db, "mak-mart-listings"), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedListings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
            setListings(fetchedListings);
            setLoadingListings(false);
        });
        return () => unsubscribe();
    }, []);

    const handleCreateClick = (category: ListingCategory) => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Login Required' });
            return;
        }
        setActiveCategory(category);
        setIsCreateOpen(true);
    };

    const filteredListings = listings.filter(listing => 
        listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        listing.user.shopName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-muted/10 min-h-screen">
            <CreateListingDialog 
                open={isCreateOpen} 
                onOpenChange={setIsCreateOpen} 
                category={activeCategory} 
            />
            <ViewListingDialog 
                open={!!selectedListing} 
                onOpenChange={(open) => !open && setSelectedListing(null)} 
                listing={selectedListing} 
            />

            <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
                <header className="flex flex-col gap-4">
                    <div>
                        <h1 className="text-4xl font-black font-headline tracking-tighter text-primary">MakMart</h1>
                        <p className="text-muted-foreground font-medium">Campus Marketplace • Buy, Rent & Services</p>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            placeholder="Search campus marketplace..." 
                            className="pl-12 h-14 bg-card border-none shadow-sm rounded-2xl text-lg focus-visible:ring-primary" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        <Button variant="default" size="sm" onClick={() => handleCreateClick('sale')} className="rounded-full px-5 font-bold">Sell Item</Button>
                        <Button variant="outline" size="sm" onClick={() => handleCreateClick('lease')} className="rounded-full px-5 font-bold">Lease</Button>
                        <Button variant="outline" size="sm" onClick={() => handleCreateClick('service')} className="rounded-full px-5 font-bold">Service</Button>
                    </div>
                </header>

                <Tabs defaultValue="items" className="w-full">
                    <TabsList className="w-full h-14 bg-card p-1 rounded-2xl border-none shadow-sm mb-6">
                        <TabsTrigger value="items" className="flex-1 rounded-xl h-full font-black text-sm transition-all data-[state=active]:bg-primary data-[state=active]:text-white">ITEMS</TabsTrigger>
                        <TabsTrigger value="shops" className="flex-1 rounded-xl h-full font-black text-sm transition-all data-[state=active]:bg-primary data-[state=active]:text-white">SHOPS</TabsTrigger>
                    </TabsList>

                    <TabsContent value="items">
                        {loadingListings ? (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                                {[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-[4/5] w-full rounded-2xl" />)}
                            </div>
                        ) : filteredListings.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
                                {filteredListings.map(listing => (
                                    <ListingCard key={listing.id} listing={listing} onClick={() => setSelectedListing(listing)} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-card rounded-2xl border-2 border-dashed flex flex-col items-center">
                                <Package className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                                <p className="text-muted-foreground font-bold">No matching items found.</p>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="shops">
                        <div className="text-center py-24 bg-card rounded-2xl border-2 border-dashed flex flex-col items-center px-6">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                                <Store className="h-8 w-8 text-primary" />
                            </div>
                            <h3 className="text-2xl font-black font-headline text-primary mb-2">Feature Coming Soon</h3>
                            <p className="text-muted-foreground max-w-sm font-medium">Be ready to upload all your items in one place. Your campus storefront is almost ready.</p>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
            <div className="h-20" /> {/* Spacer for bottom nav */}
        </div>
    );
}
