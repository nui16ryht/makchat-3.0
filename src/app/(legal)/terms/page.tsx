"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { Gavel, CheckCircle2, ShieldOff, Ban, ShoppingBag, Briefcase, Landmark } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function TermsOfServicePage() {
  const [date, setDate] = useState('');

  useEffect(() => {
    setDate(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
  }, []);

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4 md:p-8">
        <Card className="w-full max-w-5xl border-none shadow-2xl my-8 overflow-hidden rounded-[2.5rem]">
            <CardHeader className="bg-primary/5 border-b pb-12 pt-12 px-8 md:px-12">
                <div className="flex items-center gap-4 mb-4">
                    <div className="bg-primary/20 p-3 rounded-2xl">
                        <Gavel className="h-10 w-10 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-5xl font-black font-headline tracking-tighter">Terms & Conditions</CardTitle>
                        <p className="text-muted-foreground font-medium text-lg">The Makerere Network Constitution</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <p className="text-xs font-bold uppercase tracking-widest text-primary">Strictly Effective as of: {date || 'Loading...'}</p>
                </div>
            </CardHeader>
            <CardContent className="p-8 md:p-12 space-y-12">
                
                <div className="bg-destructive/5 border border-destructive/20 p-8 rounded-[2rem] flex gap-6">
                    <ShieldOff className="h-10 w-10 text-destructive shrink-0" />
                    <div className="space-y-2">
                        <p className="text-destructive font-black text-xl uppercase tracking-tighter">Legal Disclaimer & Limitation of Liability</p>
                        <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                            MakChat is provided "AS IS" without any warranties. The developers, administrators, and owners of this platform are <strong>NOT LIABLE</strong> for any financial losses, physical harm, academic repercussions, or emotional distress resulting from the use of this app. By using MakChat, you waive all rights to sue or seek damages from the platform creators for any interaction, transaction, or data loss.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <section className="space-y-4">
                        <h2 className="text-2xl font-black flex items-center gap-3"><CheckCircle2 className="h-6 w-6 text-primary"/> 1. Eligibility</h2>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Access is strictly restricted to current students and staff of Makerere University and MUBS. Use of a non-official email to bypass verification is grounds for a permanent hardware-level ban. You are responsible for maintaining the security of your account credentials.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-black flex items-center gap-3"><Landmark className="h-6 w-6 text-primary"/> 2. The Curia (Anonymity)</h2>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Anonymity in The Curia is a privilege, not a right. While we mask your identity from peers, we retain technical logs. Targeted harassment, doxxing of staff/students, or inciting campus violence will result in the unmasking of your identity to University authorities. "Banter" must remain respectful of human dignity.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-black flex items-center gap-3"><ShoppingBag className="h-6 w-6 text-primary"/> 3. MakMart Transactions</h2>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            MakChat is a venue, not a merchant. We do not verify the quality, safety, or legality of items listed. All trade occurs at your own risk. Do not send money via mobile money before seeing an item. Counterfeit goods or academic "cheat" materials are strictly prohibited.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-black flex items-center gap-3"><Briefcase className="h-6 w-6 text-primary"/> 4. The Gig Board</h2>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            The Gig Board facilitates peer-to-peer freelance work. No employment relationship is created between MakChat and any user. We are not liable for non-payment or poor-quality work. We recommend using the "Show Interest" feature to keep a record of agreements.
                        </p>
                    </section>
                </div>

                <Separator className="bg-primary/10" />

                <section className="space-y-6">
                    <h2 className="text-3xl font-black tracking-tighter">5. Prohibited Content</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                            "Pornographic or explicit media",
                            "Sale of illegal substances",
                            "Academic fraud/Exam papers",
                            "Hate speech or tribalism",
                            "Botting/Automated scraping",
                            "Impersonating University officials"
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2 p-4 bg-muted/50 rounded-2xl border border-primary/5 text-sm font-bold">
                                <Ban className="h-4 w-4 text-destructive" /> {item}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black">6. Admin Authority</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        Administrators reserve the right to delete any content, ban any user, or shut down the service at any time without prior notice or explanation. Suspensions applied via the Command Center are final and not subject to appeal unless specified by the moderator.
                    </p>
                </section>

                <div className="pt-12 border-t text-center space-y-6">
                    <p className="text-sm text-muted-foreground italic max-w-2xl mx-auto font-medium">
                        By clicking "I Agree" during signup or by continued use of this platform, you signify your irrevocable acceptance of these terms and your agreement to hold the creators harmless under all circumstances.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Button asChild size="lg" className="rounded-full px-12 font-black h-14">
                            <Link href="/">I Understand & Agree</Link>
                        </Button>
                        <Button asChild variant="outline" size="lg" className="rounded-full px-12 font-black h-14">
                            <Link href="/privacy">View Privacy Policy</Link>
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
        <footer className="mb-12 text-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            MakChat Legal Department &middot; Makerere University Campus
        </footer>
    </div>
  );
}