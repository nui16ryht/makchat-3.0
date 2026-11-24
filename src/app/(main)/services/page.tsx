
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Coffee, HelpCircle, Newspaper, ChevronRight, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ServicesPage() {
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6 pb-20 md:pb-6">
            <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0">
                    <CardTitle className="text-4xl font-black font-headline tracking-tighter">Campus Services</CardTitle>
                    <CardDescription className="text-lg">Utility tools designed for the modern Makerere student.</CardDescription>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* MakNews */}
                <Link href="/services/mak-news">
                    <Card className="group h-full overflow-hidden border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all cursor-pointer relative rounded-[2rem]">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Newspaper className="h-32 w-32 -mr-8 -mt-8" />
                        </div>
                        <CardHeader className="relative z-10 h-full flex flex-col justify-between">
                            <div>
                                <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-4 text-white shadow-lg shadow-primary/20">
                                    <Newspaper className="h-7 w-7" />
                                </div>
                                <CardTitle className="text-3xl font-black font-headline tracking-tight text-primary">MakNews</CardTitle>
                                <CardDescription className="text-sm font-medium max-w-md mt-1">Stay updated with verified campus journalism and academic announcements.</CardDescription>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <Button variant="ghost" size="icon" className="rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                    <ChevronRight className="h-6 w-6" />
                                </Button>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>

                {/* Gig Board */}
                <Link href="/services/gig-board">
                    <Card className="group h-full overflow-hidden border-accent/20 bg-accent/5 hover:bg-accent/10 transition-all cursor-pointer relative rounded-[2rem]">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Briefcase className="h-32 w-32 -mr-8 -mt-8" />
                        </div>
                        <CardHeader className="relative z-10 h-full flex flex-col justify-between">
                            <div>
                                <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center mb-4 text-white shadow-lg shadow-accent/20">
                                    <Briefcase className="h-7 w-7" />
                                </div>
                                <CardTitle className="text-3xl font-black font-headline tracking-tight text-accent">Gig Board</CardTitle>
                                <CardDescription className="text-sm font-medium max-w-md mt-1">Find campus jobs, freelance tasks, or hire students for your errands.</CardDescription>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <Button variant="ghost" size="icon" className="rounded-full bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-all">
                                    <ChevronRight className="h-6 w-6" />
                                </Button>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>

                {/* Cafeteria Menus */}
                <Link href="/services/cafeteria">
                    <Card className="group h-full overflow-hidden border-blue-200 bg-blue-50/30 hover:bg-blue-50/50 transition-all cursor-pointer relative rounded-[2rem]">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Coffee className="h-32 w-32 -mr-8 -mt-8" />
                        </div>
                        <CardHeader className="relative z-10 h-full flex flex-col justify-between">
                            <div>
                                <div className="h-14 w-14 rounded-2xl bg-blue-500 flex items-center justify-center mb-4 text-white shadow-lg shadow-blue-200">
                                    <Coffee className="h-7 w-7" />
                                </div>
                                <CardTitle className="text-3xl font-black font-headline tracking-tight text-blue-600">Cafeteria Menus</CardTitle>
                                <CardDescription className="text-sm font-medium max-w-md mt-1">See what's cooking at University Hall, Guild Canteen, and other campus spots.</CardDescription>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <Button variant="ghost" size="icon" className="rounded-full bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                    <ChevronRight className="h-6 w-6" />
                                </Button>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>

                {/* Lost & Found */}
                <Link href="/services/lost-and-found">
                    <Card className="group h-full overflow-hidden border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-all cursor-pointer relative rounded-[2rem]">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <HelpCircle className="h-32 w-32 -mr-8 -mt-8" />
                        </div>
                        <CardHeader className="relative z-10 h-full flex flex-col justify-between">
                            <div>
                                <div className="h-14 w-14 rounded-2xl bg-destructive flex items-center justify-center mb-4 text-white shadow-lg shadow-destructive/20">
                                    <HelpCircle className="h-7 w-7" />
                                </div>
                                <CardTitle className="text-3xl font-black font-headline tracking-tight text-destructive">Lost & Found</CardTitle>
                                <CardDescription className="text-sm font-medium max-w-md mt-1">Report items to help fellow students find their property.</CardDescription>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <Button variant="ghost" size="icon" className="rounded-full bg-destructive/10 text-destructive group-hover:bg-destructive group-hover:text-white transition-all">
                                    <ChevronRight className="h-6 w-6" />
                                </Button>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>
            </div>
        </div>
    );
}
