"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, Timestamp, writeBatch, getDocs, where } from 'firebase/firestore';
import { Loader2, Trash2, CheckCircle, ShieldAlert, Clock, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type Report = {
    id: string;
    type: 'post' | 'poll' | 'listing';
    entityId: string;
    content: string;
    authorName: string;
    timestamp: Timestamp;
    reporterId: string;
};

export default function ReportsPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [accessCode, setAccessCode] = useState('');
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
    const { toast } = useToast();

    // Standardized access code
    const REQUIRED_CODE = 'nuwagabawright4105';

    useEffect(() => {
        if (!isAuthenticated) return;

        setLoading(true);
        const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
            setReports(fetchedReports);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isAuthenticated]);

    const handleAuthenticate = (e: React.FormEvent) => {
        e.preventDefault();
        if (accessCode === REQUIRED_CODE) {
            setIsAuthenticated(true);
            toast({ title: "Access Granted", description: "Moderation tools enabled." });
        } else {
            toast({ variant: "destructive", title: "Access Denied", description: "Invalid admin code." });
        }
    };

    const handleDeleteContent = async (report: Report) => {
        setIsActionLoading(report.id);
        try {
            const batch = writeBatch(db);
            const collectionMap = {
                post: 'posts',
                poll: 'polls',
                listing: 'mak-mart-listings'
            };
            
            const entityRef = doc(db, collectionMap[report.type], report.entityId);
            
            if (report.type === 'post') {
                const commentsSnap = await getDocs(collection(entityRef, 'comments'));
                commentsSnap.forEach(commentDoc => {
                    batch.delete(commentDoc.ref);
                    batch.delete(doc(db, 'comments', commentDoc.id));
                });
            }

            batch.delete(entityRef);
            
            const relatedReportsQuery = query(collection(db, 'reports'), where('entityId', '==', report.entityId));
            const relatedReportsSnap = await getDocs(relatedReportsQuery);
            relatedReportsSnap.forEach(rDoc => {
                batch.delete(rDoc.ref);
            });
            
            await batch.commit();
            
            toast({ title: "Content Removed", description: `The ${report.type} and associated data have been permanently deleted.` });
        } catch (error) {
            console.error("Error deleting content:", error);
            toast({ variant: "destructive", title: "Error", description: "An error occurred during deletion." });
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleDismissReport = async (reportId: string) => {
        setIsActionLoading(reportId);
        try {
            await deleteDoc(doc(db, 'reports', reportId));
            toast({ title: "Report Dismissed" });
        } catch (error) {
            console.error("Error dismissing report:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not dismiss report." });
        } finally {
            setIsActionLoading(null);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldAlert className="h-6 w-6 text-primary" />
                            Admin Access
                        </CardTitle>
                        <CardDescription>Enter the moderation code to view reported content.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAuthenticate} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Access Code</Label>
                                <Input 
                                    id="code" 
                                    type="password" 
                                    value={accessCode} 
                                    onChange={(e) => setAccessCode(e.target.value)} 
                                    placeholder="••••••••"
                                />
                            </div>
                            <Button type="submit" className="w-full">Unlock Reports</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Moderation Queue</CardTitle>
                    <CardDescription>Review and action reports for posts, polls, and marketplace items.</CardDescription>
                </CardHeader>
            </Card>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : reports.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                        <CheckCircle className="mx-auto h-12 w-12 mb-4 opacity-20" />
                        <h3 className="font-semibold text-lg">Inbox Zero</h3>
                        <p>No content has been reported recently.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {reports.map((report) => (
                        <Card key={report.id} className="overflow-hidden">
                            <div className="bg-muted/30 p-3 flex items-center justify-between border-b">
                                <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">{report.type}</span>
                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDistanceToNow(report.timestamp?.toDate() || new Date())} ago</span>
                                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> Author: {report.authorName}</span>
                                </div>
                            </div>
                            <CardContent className="p-4">
                                <p className="text-sm font-medium mb-4 italic text-muted-foreground border-l-4 pl-3 py-1">
                                    "{report.content.substring(0, 300)}{report.content.length > 300 ? '...' : ''}"
                                </p>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="destructive" 
                                        size="sm" 
                                        onClick={() => handleDeleteContent(report)}
                                        disabled={isActionLoading === report.id}
                                    >
                                        {isActionLoading === report.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                        Delete Content
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => handleDismissReport(report.id)}
                                        disabled={isActionLoading === report.id}
                                    >
                                        Dismiss Report
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
