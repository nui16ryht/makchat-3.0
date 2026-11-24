"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { UtensilsCrossed, Clock, ArrowLeft, Coffee, MapPin, Sunrise, Sun, StickyNote, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type MenuItem = {
    name: string;
    price: string;
};

type CafeteriaMenu = {
    id: string;
    cafeteriaName: string;
    note?: string;
    breakfastItems?: MenuItem[];
    lunchItems?: MenuItem[];
    timestamp: any;
};

export default function CafeteriaPage() {
    const [menus, setMenus] = useState<CafeteriaMenu[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMenu, setSelectedMenu] = useState<CafeteriaMenu | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'cafeteria-menus'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMenus(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CafeteriaMenu)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
                <Skeleton className="h-12 w-48 mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-3xl" />)}
                </div>
            </div>
        );
    }

    // Detail View
    if (selectedMenu) {
        return (
            <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-2xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <header className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedMenu(null)} className="rounded-full">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-black font-headline tracking-tighter text-accent flex items-center gap-3">
                                {selectedMenu.cafeteriaName}
                            </h1>
                            <p className="text-muted-foreground font-medium text-xs uppercase tracking-widest">Today's Selection</p>
                        </div>
                    </div>
                </header>

                <Card className="rounded-[2.5rem] border-none shadow-2xl bg-card overflow-hidden">
                    <CardHeader className="bg-accent/10 pb-6 pt-8 px-8">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <CardTitle className="text-3xl font-black tracking-tighter">{selectedMenu.cafeteriaName}</CardTitle>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    <Clock className="h-3.5 w-3.5" /> Updated {format(selectedMenu.timestamp?.toDate() || new Date(), 'h:mm a')}
                                </div>
                            </div>
                            <div className="bg-white/50 p-2.5 rounded-2xl">
                                <UtensilsCrossed className="h-6 w-6 text-accent" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 pt-6 space-y-8">
                        {/* Breakfast Section */}
                        {selectedMenu.breakfastItems && selectedMenu.breakfastItems.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-accent font-black text-[10px] uppercase tracking-widest border-b border-accent/10 pb-2">
                                    <Sunrise className="h-3 w-3" /> Breakfast Menu
                                </div>
                                <div className="space-y-3">
                                    {selectedMenu.breakfastItems.map((item, i) => (
                                        <div key={i} className="flex justify-between items-center group">
                                            <span className="font-bold text-muted-foreground group-hover:text-foreground transition-colors">{item.name}</span>
                                            <div className="flex-1 border-b-2 border-dotted border-muted mx-2 mb-1" />
                                            <span className="text-accent font-black">{item.price} UGX</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Lunch Section */}
                        {selectedMenu.lunchItems && selectedMenu.lunchItems.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest border-b border-primary/10 pb-2">
                                    <Sun className="h-3 w-3" /> Lunch & Main Menu
                                </div>
                                <div className="space-y-3">
                                    {selectedMenu.lunchItems.map((item, i) => (
                                        <div key={i} className="flex justify-between items-center group">
                                            <span className="font-bold text-muted-foreground group-hover:text-foreground transition-colors">{item.name}</span>
                                            <div className="flex-1 border-b-2 border-dotted border-muted mx-2 mb-1" />
                                            <span className="text-primary font-black">{item.price} UGX</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedMenu.note && (
                            <div className="p-4 bg-muted/30 rounded-2xl border-l-4 border-accent">
                                <p className="text-xs font-bold text-muted-foreground italic leading-relaxed flex gap-2">
                                    <StickyNote className="h-3 w-3 shrink-0 text-accent mt-0.5" />
                                    "{selectedMenu.note}"
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Button variant="outline" onClick={() => setSelectedMenu(null)} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs border-primary/20 text-primary">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cafeterias
                </Button>
            </div>
        );
    }

    // List View
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto pb-24 animate-in fade-in duration-500">
            <header className="space-y-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild className="rounded-full">
                        <Link href="/services"><ArrowLeft className="h-5 w-5" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-4xl font-black font-headline tracking-tighter text-accent flex items-center gap-3">
                            Campus Dining <Coffee className="h-8 w-8" />
                        </h1>
                        <p className="text-muted-foreground font-medium">Choose a cafeteria to see today's menu.</p>
                    </div>
                </div>
            </header>

            {menus.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed">
                    <UtensilsCrossed className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                    <p className="text-muted-foreground font-bold italic">No cafeteria menus have been posted for today yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {menus.map((menu) => (
                        <Card 
                            key={menu.id} 
                            className="group rounded-[2rem] border-none shadow-sm bg-card overflow-hidden transition-all hover:scale-[1.02] hover:shadow-xl cursor-pointer"
                            onClick={() => setSelectedMenu(menu)}
                        >
                            <CardContent className="p-8 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                                        <UtensilsCrossed className="h-7 w-7" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black tracking-tight">{menu.cafeteriaName}</h3>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tap to view menu</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <div className="mt-12 p-8 bg-accent/5 rounded-[2.5rem] border border-accent/10 flex flex-col md:flex-row items-center gap-6">
                <div className="h-16 w-16 rounded-3xl bg-accent flex items-center justify-center shrink-0 shadow-lg shadow-accent/20">
                    <UtensilsCrossed className="h-8 w-8 text-white" />
                </div>
                <div>
                    <h3 className="text-xl font-black tracking-tight text-accent">Student Dining Info</h3>
                    <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                        We update these daily based on official campus canteen data. If your favorite cafeteria is missing, let the management know!
                    </p>
                </div>
            </div>
        </div>
    );
}
