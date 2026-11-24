"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { Shield, Database, MessageSquare, MapPin, Smartphone, RefreshCcw } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const [date, setDate] = useState('');

  useEffect(() => {
    setDate(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
  }, []);

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4 md:p-8">
        <Card className="w-full max-w-5xl border-none shadow-2xl my-8 overflow-hidden rounded-[2.5rem]">
            <CardHeader className="bg-accent/5 border-b pb-12 pt-12 px-8 md:px-12">
                <div className="flex items-center gap-4 mb-4">
                    <div className="bg-accent/20 p-3 rounded-2xl">
                        <Shield className="h-10 w-10 text-accent" />
                    </div>
                    <div>
                        <CardTitle className="text-5xl font-black font-headline tracking-tighter">Privacy Policy</CardTitle>
                        <p className="text-muted-foreground font-medium text-lg">Your Data Rights on Campus</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                    <p className="text-xs font-bold uppercase tracking-widest text-accent">Last Comprehensive Audit: {date || 'Loading...'}</p>
                </div>
            </CardHeader>
            <CardContent className="p-8 md:p-12 space-y-12">
                
                <section className="space-y-4">
                    <h2 className="text-3xl font-black tracking-tighter flex items-center gap-3 text-accent">
                        <Database className="h-8 w-8" /> 1. Data Collection
                    </h2>
                    <p className="text-muted-foreground leading-relaxed font-medium">
                        To maintain a safe and exclusive environment for Makerere students, we collect the following:
                    </p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { title: "Identity", desc: "Official student email, Name, and unique Username." },
                            { title: "Presence", desc: "Real-time 'Online' status and 'Last Seen' timestamps." },
                            { title: "Network", desc: "Who you follow and who follows you back." },
                            { title: "Push", desc: "Device FCM tokens for real-time notifications." }
                        ].map((item, i) => (
                            <li key={i} className="p-5 bg-card border rounded-2xl shadow-sm">
                                <p className="font-black text-accent uppercase text-xs tracking-widest mb-1">{item.title}</p>
                                <p className="text-sm font-medium text-muted-foreground">{item.desc}</p>
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="space-y-6">
                    <div className="flex items-center gap-3">
                        <RefreshCcw className="h-8 w-8 text-primary" />
                        <h2 className="text-3xl font-black tracking-tighter">2. The Curia (Ephemeral Privacy)</h2>
                    </div>
                    <div className="prose prose-stone dark:prose-invert max-w-none">
                        <p className="text-muted-foreground leading-relaxed font-medium">
                            The Curia is architected for <strong>Maximum Privacy</strong>. 
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10">
                                <h4 className="font-black text-primary mb-2">Anonymous Masking</h4>
                                <p className="text-sm font-medium">Your student identity is replaced with a random nickname (e.g., "Swift Lion #402"). This mapping is hidden from all users, including moderators, unless a legal violation occurs.</p>
                            </div>
                            <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10">
                                <h4 className="font-black text-primary mb-2">Dawn Deletion</h4>
                                <p className="text-sm font-medium">Content posted in The Curia is designed to be temporary. While stored in our database for the session duration, it is programmatically filtered out of view at dawn.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="space-y-6">
                    <div className="flex items-center gap-3">
                        <MessageSquare className="h-8 w-8 text-accent" />
                        <h2 className="text-3xl font-black tracking-tighter">3. Communication & Direct Messages</h2>
                    </div>
                    <p className="text-muted-foreground leading-relaxed font-medium">
                        Your private messages are stored securely in Firestore. While we do not "read" your chats for marketing, they are accessible to platform administrators in the event of a reported harassment claim. Shared media (images/videos) are stored in Cloud Storage and are linked specifically to your conversation.
                    </p>
                </section>

                <section className="space-y-6">
                    <div className="flex items-center gap-3">
                        <MapPin className="h-8 w-8 text-accent" />
                        <h2 className="text-3xl font-black tracking-tighter">4. MakMart & Public Listings</h2>
                    </div>
                    <div className="bg-muted/50 p-8 rounded-[2rem] border border-dashed border-muted-foreground/20">
                        <p className="text-sm font-bold text-muted-foreground leading-relaxed">
                            Data provided in MakMart, The Gig Board, and Lost & Found is <strong>PUBLIC</strong> by design. Do not include your room number, private phone number, or sensitive personal details in the description fields. Use the secure Direct Message feature to finalize transaction details.
                        </p>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black flex items-center gap-3"><Smartphone className="h-6 w-6 text-accent"/> 5. Local Storage & PWA</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                        We use Local Storage to track your "Read" status on News, Polls, and Marketplace items to provide a tailored notification experience. As a PWA, MakChat may cache assets on your device to ensure offline functionality.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black">6. Your Right to Erasure</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                        You may delete your account at any time via the Settings page. This will permanently remove your profile, follows, and all public posts. Some metadata (like messages sent to others) may remain as part of their conversation history for continuity.
                    </p>
                </section>

                <div className="pt-12 border-t text-center space-y-6">
                    <p className="text-sm text-muted-foreground font-bold">Questions about your data? Reach out to your Campus Moderator.</p>
                    <Button asChild size="lg" variant="default" className="rounded-full px-12 font-black h-14 bg-accent text-white hover:bg-accent/90 shadow-xl shadow-accent/20 border-none">
                        <Link href="/terms">Back to Terms</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
        <footer className="mb-12 text-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            Privacy First &middot; Makerere University Security Standards
        </footer>
    </div>
  );
}