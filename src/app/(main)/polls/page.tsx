
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, getDoc, updateDoc, where, Timestamp, deleteDoc, runTransaction, writeBatch, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, BarChart, Loader2, X, Users, CheckCircle, Edit, Trash2, MoreHorizontal, Flag, Clock, Share, Image as ImageIcon, Lock } from 'lucide-react';
import { GuestBanner } from '@/components/makchat/guest-banner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';
import NextImage from 'next/image';


type PollOption = {
  id: number;
  text: string;
  votes: string[]; // Array of user UIDs
  imageUrl?: string;
};

type Poll = {
  id: string;
  question: string;
  options: PollOption[];
  author: {
    uid: string;
    name: string;
    avatar: string;
  };
  createdAt: Timestamp;
  expiresAt: Timestamp | null;
  totalVotes: number;
};

const CreatePollDialog = ({ open, onOpenChange, pollToEdit, onPollCreated }: { open: boolean; onOpenChange: (open: boolean) => void, pollToEdit?: Poll | null; onPollCreated: () => void; }) => {
  const [user] = useAuthState(auth);
  const { toast } = useToast();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<{ text: string; imageFile: File | null; imageUrl?: string }[]>([{ text: '', imageFile: null }, { text: '', imageFile: null }]);
  const [adminCode, setAdminCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (open) {
        if (pollToEdit) {
            setQuestion(pollToEdit.question);
            setOptions(pollToEdit.options.map(o => ({ text: o.text, imageUrl: o.imageUrl, imageFile: null })));
            setExpiryDate(pollToEdit.expiresAt ? pollToEdit.expiresAt.toDate().toISOString().slice(0, 16) : '');
        } else {
            resetForm();
        }
    }
  }, [open, pollToEdit]);

  const resetForm = () => {
    setQuestion('');
    setOptions([{ text: '', imageFile: null }, { text: '', imageFile: null }]);
    setExpiryDate('');
    setAdminCode('');
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index].text = value;
    setOptions(newOptions);
  };
  
  const handleImageChange = (index: number, file: File | null) => {
      const newOptions = [...options];
      newOptions[index].imageFile = file;
      if (file) {
        newOptions[index].imageUrl = URL.createObjectURL(file);
      } else {
        newOptions[index].imageUrl = undefined;
      }
      setOptions(newOptions);
  }

  const addOption = () => {
    if (options.length < 5) {
      setOptions([...options, { text: '', imageFile: null }]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Not logged in' });
      return;
    }

    if (!pollToEdit && adminCode !== 'nuwagabawright4105') {
        toast({ 
            variant: 'destructive', 
            title: 'Invalid Code', 
            description: adminCode ? 'The code you entered is incorrect.' : 'Please enter a code to create a poll. Contact the admin to get one.' 
        });
        return;
    }

    if (!question.trim() || options.some(o => !o.text.trim())) {
      toast({ variant: 'destructive', title: 'Missing information', description: 'Please fill in the question and all options.' });
      return;
    }
    if (expiryDate && new Date(expiryDate) < new Date()) {
        toast({ variant: 'destructive', title: 'Invalid Date', description: 'Expiration date cannot be in the past.' });
        return;
    }

    setIsSaving(true);
    try {
        const expiresAt = expiryDate ? Timestamp.fromDate(new Date(expiryDate)) : null;

        if (pollToEdit) {
            const pollRef = doc(db, 'polls', pollToEdit.id);
            await updateDoc(pollRef, {
                question,
                expiresAt,
            });
            toast({ title: 'Poll Updated!', description: 'Your poll has been successfully updated.' });
        } else {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists()) throw new Error("User profile not found.");
            const userData = userDoc.data();

            const finalOptions: Omit<PollOption, 'votes'>[] = await Promise.all(
                options.map(async (opt, index) => {
                    let imageUrl: string | undefined = undefined;
                    if (opt.imageFile) {
                        const imageRef = ref(storage, `polls/${user.uid}/${Date.now()}_${opt.imageFile.name}`);
                        const snapshot = await uploadBytes(imageRef, opt.imageFile);
                        imageUrl = await getDownloadURL(snapshot.ref);
                    }
                    return { id: index, text: opt.text, imageUrl };
                })
            );

            await addDoc(collection(db, 'polls'), {
                question,
                options: finalOptions.map(opt => ({...opt, votes: []})),
                author: {
                uid: user.uid,
                name: userData.name,
                avatar: userData.avatar,
                },
                createdAt: serverTimestamp(),
                expiresAt: expiresAt,
                totalVotes: 0,
                timestamp: serverTimestamp(), // For unread tracking
            });
            onPollCreated();
            toast({ title: 'Poll Created!', description: 'Your poll is now live.' });
        }
        
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving poll:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save poll.' });
    } finally {
      setIsSaving(false);
    }
  };
  
  const formTitle = pollToEdit ? "Edit Your Poll" : "Create a New Poll";
  const formDescription = pollToEdit ? "Update the details of your poll below." : "Ask the community a question. Add up to 5 options.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{formTitle}</DialogTitle>
          <DialogDescription>{formDescription}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
          {!pollToEdit && (
            <div className="space-y-2">
                <Label htmlFor="admin-code" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Admin Code
                </Label>
                <Input 
                    id="admin-code" 
                    value={adminCode} 
                    onChange={(e) => setAdminCode(e.target.value)} 
                    placeholder="Enter code to verify poll creation" 
                />
                <p className="text-[10px] text-muted-foreground italic">Contact the admin if you don't have a code.</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="question">Question</Label>
            <Input id="question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What's your question?" />
          </div>
          <div className="space-y-3">
            <Label>Options</Label>
            {options.map((option, index) => (
              <div key={index} className="space-y-2 p-2 border rounded-md">
                <div className="flex items-center gap-2">
                  <Input
                    value={option.text}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    disabled={!!pollToEdit}
                  />
                  {!pollToEdit && (
                    <Button variant="ghost" size="icon" onClick={() => fileInputRefs.current[index]?.click()}>
                        <ImageIcon className="h-4 w-4" />
                    </Button>
                  )}
                  {options.length > 2 && !pollToEdit && (
                    <Button variant="ghost" size="icon" onClick={() => removeOption(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                 {!pollToEdit && (
                    <>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={el => {
                                if (el) fileInputRefs.current[index] = el;
                            }}
                            onChange={(e) => handleImageChange(index, e.target.files?.[0] || null)}
                        />
                        {option.imageUrl && (
                            <div className="relative w-full aspect-video rounded-md overflow-hidden">
                                <NextImage src={option.imageUrl} alt={`Preview for option ${index+1}`} fill className="object-cover"/>
                                <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => handleImageChange(index, null)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </>
                 )}
              </div>
            ))}
            {options.length < 5 && !pollToEdit && (
              <Button variant="outline" size="sm" onClick={addOption}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Option
              </Button>
            )}
          </div>
           {pollToEdit && <p className="text-xs text-muted-foreground">Options and images cannot be changed after a poll is created to maintain voting integrity.</p>}

           <div className="space-y-2">
                <Label htmlFor="expiry-date">Voting Ends (Optional)</Label>
                <Input 
                    id="expiry-date" 
                    type="datetime-local" 
                    value={expiryDate} 
                    onChange={e => setExpiryDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                />
            </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save Poll'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PollCard = ({ poll, onVote, onEdit, onDelete }: { poll: Poll; onVote: (pollId: string, optionId: number) => void; onEdit: (poll: Poll) => void; onDelete: (pollId: string) => void; }) => {
  const [user] = useAuthState(auth);
  const { toast } = useToast();
  const userVote = user ? poll.options.find(opt => opt.votes.includes(user.uid)) : null;
  const isAuthor = user?.uid === poll.author.uid;
  const isExpired = poll.expiresAt ? poll.expiresAt.toDate() < new Date() : false;

  const handleVote = (optionId: number) => {
    if (isExpired) {
        toast({ variant: 'destructive', title: 'Voting Closed', description: 'This poll is no longer accepting votes.'});
        return;
    }
    if (!user) {
        toast({ variant: 'destructive', title: 'Please log in to vote.' });
        return;
    }
    onVote(poll.id, optionId);
  }
  
  const handleShare = (e: React.MouseEvent) => {
      e.stopPropagation();
      const pollUrl = `${window.location.origin}/polls?pollId=${poll.id}`;
      navigator.clipboard.writeText(pollUrl);
      toast({ title: "Link Copied!", description: "Poll link copied to clipboard." });
  }

  const handleReport = async () => {
    if (!user) return;
    try {
        await addDoc(collection(db, 'reports'), {
            type: 'poll',
            entityId: poll.id,
            content: poll.question,
            authorName: poll.author.name,
            timestamp: serverTimestamp(),
            reporterId: user.uid,
        });
        toast({ title: 'Poll Reported', description: 'Thank you for your feedback. We will review this poll.' });
    } catch (error) {
        console.error("Error reporting poll:", error);
    }
  }
  
  const expiryText = () => {
    if (isExpired) return "Voting closed";
    if (poll.expiresAt) return `Closes in ${formatDistanceToNow(poll.expiresAt.toDate())}`;
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
            <CardTitle>{poll.question}</CardTitle>
             <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{poll.totalVotes} votes</span>
              </div>
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isAuthor ? (
                      <>
                        <DropdownMenuItem onClick={() => onEdit(poll)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Delete Poll?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete this poll? This action cannot be undone.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(poll.id)}>
                                    Delete
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                      </>
                    ) : (
                      <DropdownMenuItem onClick={handleReport} className="text-destructive focus:text-destructive">
                        <Flag className="mr-2 h-4 w-4" /> Report
                      </DropdownMenuItem>
                    )}
                     <DropdownMenuItem onClick={handleShare}>
                        <Share className="mr-2 h-4 w-4" /> Share
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
        <CardDescription>
          Asked by {poll.author.name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={cn("space-y-3", poll.options.some(o => o.imageUrl) && "grid grid-cols-1 sm:grid-cols-2 gap-3")}>
          {poll.options.map(option => {
            const percentage = poll.totalVotes > 0 ? (option.votes.length / poll.totalVotes) * 100 : 0;
            const isVotedByUser = userVote?.id === option.id;

            return (
              <div key={option.id} className={cn("border rounded-lg overflow-hidden", isVotedByUser && (userVote || isExpired) && "ring-2 ring-primary")}>
                {option.imageUrl && (
                    <div className="relative w-full aspect-video bg-muted">
                       <NextImage src={option.imageUrl} alt={option.text} fill className="object-cover" />
                    </div>
                )}
                <div className="p-3">
                    {userVote || isExpired ? (
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{option.text}</span>
                            {isVotedByUser && <CheckCircle className="h-4 w-4 text-primary" />}
                        </div>
                        <span className="text-muted-foreground">{percentage.toFixed(0)}%</span>
                        </div>
                        <Progress value={percentage} indicatorClassName={isVotedByUser ? 'bg-primary' : 'bg-primary/30'}/>
                    </div>
                    ) : (
                    <Button variant="outline" className="w-full justify-start h-auto py-2" onClick={() => handleVote(option.id)}>
                        {option.text}
                    </Button>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
      {expiryText() && (
        <CardFooter className="text-xs text-muted-foreground pt-4 border-t flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>{expiryText()}</span>
        </CardFooter>
      )}
    </Card>
  );
}


export default function PollsPage() {
  const [user, loadingAuth] = useAuthState(auth);
  const [allPolls, setAllPolls] = useState<Poll[]>([]);
  const [sortedPolls, setSortedPolls] = useState<Poll[]>([]);
  const [loadingPolls, setLoadingPolls] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pollToEdit, setPollToEdit] = useState<Poll | null>(null);
  const [userPollsToday, setUserPollsToday] = useState(0);
  const { toast } = useToast();
  
  const POLL_LIMIT_PER_DAY = 2;

  useEffect(() => {
    localStorage.setItem('lastReadPolls', Date.now().toString());
  }, []);

  useEffect(() => {
    setLoadingPolls(true);
    const q = query(collection(db, "polls"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPolls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Poll));
      setAllPolls(fetchedPolls);
      setLoadingPolls(false);
    });
    return () => unsubscribe();
  }, []);
  
  // Sort polls whenever the list changes
  useEffect(() => {
    const now = new Date();
    const activePolls = allPolls.filter(p => !p.expiresAt || p.expiresAt.toDate() > now);
    const closedPolls = allPolls.filter(p => p.expiresAt && p.expiresAt.toDate() <= now);
    
    // Sort active polls: most recent first
    activePolls.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
    
    // Sort closed polls: newest closed first
    closedPolls.sort((a, b) => (b.expiresAt?.toMillis() ?? 0) - (a.expiresAt?.toMillis() ?? 0));
    
    const popularActivePolls = [...activePolls].sort((a, b) => b.totalVotes - a.totalVotes);
    
    const combined = [...new Set([...popularActivePolls, ...activePolls, ...closedPolls])];

    setSortedPolls(combined);

  }, [allPolls]);
  
  useEffect(() => {
    if (!user) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const pollsQuery = query(
      collection(db, "polls"),
      where('author.uid', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(pollsQuery, (snapshot) => {
        let count = 0;
        snapshot.forEach(doc => {
            const poll = doc.data() as Poll;
            if (poll.createdAt && poll.createdAt.toDate() >= today) {
                count++;
            }
        });
        setUserPollsToday(count);
    });
    
    return () => unsubscribe();

  }, [user]);

  const handleVote = async (pollId: string, optionId: number) => {
    if (!user) return;

    const pollRef = doc(db, 'polls', pollId);

    try {
        await runTransaction(db, async (transaction) => {
            const pollDoc = await transaction.get(pollRef);
            if (!pollDoc.exists()) {
                throw "Poll not found!";
            }

            const pollData = pollDoc.data() as Omit<Poll, 'id'>;

            const userHasVoted = pollData.options.some(opt => opt.votes.includes(user.uid));
            
            const updatedOptions = pollData.options.map(opt => {
                // Remove user's UID from all options first
                const votes = opt.votes.filter(uid => uid !== user.uid);
                // Then add it to the selected option
                if (opt.id === optionId) {
                    votes.push(user.uid);
                }
                return { ...opt, votes };
            });

            // Only increment total votes if the user hasn't voted before in this poll
            const newTotalVotes = userHasVoted ? pollData.totalVotes : pollData.totalVotes + 1;

            transaction.update(pollRef, {
                options: updatedOptions,
                totalVotes: newTotalVotes
            });
        });

        toast({ title: 'Vote Cast!', description: 'Your vote has been recorded.' });

    } catch (error) {
        console.error("Error voting:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not cast your vote.' });
    }
  };
  
  const handleCreateClick = () => {
    if (userPollsToday >= POLL_LIMIT_PER_DAY) {
        toast({ variant: 'destructive', title: 'Daily Limit Reached', description: `You can only create ${POLL_LIMIT_PER_DAY} polls per day.`});
        return;
    }
    setPollToEdit(null);
    setIsCreateOpen(true);
  };
  
  const handleEditClick = (poll: Poll) => {
    setPollToEdit(poll);
    setIsCreateOpen(true);
  };

  const handleDeletePoll = async (pollId: string) => {
    try {
        const batch = writeBatch(db);
        const pollRef = doc(db, 'polls', pollId);
        
        // 1. Clean up associated reports
        const reportsQuery = query(collection(db, 'reports'), where('entityId', '==', pollId));
        const reportsSnap = await getDocs(reportsQuery);
        reportsSnap.forEach(rDoc => batch.delete(rDoc.ref));
        
        // 2. Delete the poll
        batch.delete(pollRef);
        
        await batch.commit();
        toast({ title: "Poll Deleted", description: "Your poll has been removed." });
    } catch(error) {
        console.error("Error deleting poll:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the poll.' });
    }
  };


  if (loadingAuth) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-6 pb-20 md:pb-6">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
      </div>
    );
  }

  if (!user) {
    return <div className="p-4"><GuestBanner /></div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 pb-20 md:pb-6">
      <CreatePollDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} pollToEdit={pollToEdit} onPollCreated={() => setUserPollsToday(count => count + 1)} />
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Community Polls</CardTitle>
            <CardDescription>Vote on polls or create your own. You can create {Math.max(0, POLL_LIMIT_PER_DAY - userPollsToday)} more polls today.</CardDescription>
          </div>
          <Button onClick={handleCreateClick} disabled={userPollsToday >= POLL_LIMIT_PER_DAY}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create Poll
          </Button>
        </CardHeader>
      </Card>

      {loadingPolls ? (
        <div className="space-y-6">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : sortedPolls.length > 0 ? (
        <div className="space-y-6">
            {sortedPolls.map(poll => <PollCard key={poll.id} poll={poll} onVote={handleVote} onEdit={handleEditClick} onDelete={handleDeletePoll}/>)}
        </div>
      ) : (
        <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
                <BarChart className="mx-auto h-12 w-12 mb-4" />
                <h3 className="font-semibold text-lg">No Polls Yet</h3>
                <p>Be the first to create a poll and see what the community thinks!</p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
