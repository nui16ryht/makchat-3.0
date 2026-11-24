
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Gamepad2, ArrowLeft, Zap, Play, 
    ChevronRight, Plus, Users, 
    HelpCircle, Sword, BookOpen, Send,
    Loader2, X, Clock, User, Eye, CheckCircle2, UserCheck,
    Flag, RotateCw, Trophy, Users2, UserCircle2, SkipForward
} from 'lucide-react';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, getDoc, addDoc, serverTimestamp, arrayUnion, arrayRemove, where, deleteDoc, Timestamp, runTransaction, writeBatch } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// --- CONSTANTS & WORD DECKS ---

const FASTA_WORDS: Record<string, string[]> = {
    campus: [
        "Kikomando", "Lumumba Hall", "Mitchell Hall", "CIT Block", "Main Library", 
        "Retake", "Guild President", "Freshers Bazaar", "Freedom Square", "Mary Stuart", 
        "Complex Hall", "Boda Boda", "Wandegeya", "Javas", "Kankisi", "Coursework",
        "North Court", "Makerere Guest House", "Prime Time", "Gown", "Chancellor"
    ],
    uganda: [
        "Rolex", "Matooke", "Nyege Nyege", "Sitya Loss", "Ghetto President", 
        "Kampala", "Entebbe", "Parliament", "Bobi Wine", "Jose Chameleone", 
        "Eddy Kenzo", "Gorillas", "River Nile", "Luzira", "Mobile Money"
    ],
    general: [
        "Elephant", "Pizza", "Guitar", "Smartphone", "Airplane", "Football", 
        "Hospital", "Chocolate", "Internet", "Submarine", "Astronaut", "Mountain",
        "Rainbow", "Diamond", "Telescope", "Coffee", "Camera"
    ]
};

const GAME_LIST = [
    { 
        id: 'fasta', 
        name: 'Fasta!', 
        icon: Zap, 
        color: 'bg-yellow-500', 
        playable: true, 
        type: 'online', 
        desc: 'Speed word-guessing battle',
        instructions: "Describer gets 5 words. Don't say the word, a synonym, or translation. Guessers call out answers. Host/Describer marks 'Correct'. Reach the score cap to win!"
    },
    { 
        id: 'chess', 
        name: 'Chess', 
        icon: Sword, 
        color: 'bg-[#b58863]', 
        playable: true, 
        type: 'online', 
        desc: 'Online strategy battle',
        instructions: "Tournament Chess. The Host assigns White and Black players. White moves first. Clocks run only during your turn. Checkmate to win!"
    }
];

type ChessPiece = { type: 'p' | 'r' | 'n' | 'b' | 'q' | 'k'; color: 'w' | 'b'; } | null;

const INITIAL_BOARD: ChessPiece[] = [
    {type:'r', color:'b'}, {type:'n', color:'b'}, {type:'b', color:'b'}, {type:'q', color:'b'}, {type:'k', color:'b'}, {type:'b', color:'b'}, {type:'n', color:'b'}, {type:'r', color:'b'},
    {type:'p', color:'b'}, {type:'p', color:'b'}, {type:'p', color:'b'}, {type:'p', color:'b'}, {type:'p', color:'b'}, {type:'p', color:'b'}, {type:'p', color:'b'}, {type:'p', color:'b'},
    null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null,
    {type:'p', color:'w'}, {type:'p', color:'w'}, {type:'p', color:'w'}, {type:'p', color:'w'}, {type:'p', color:'w'}, {type:'p', color:'w'}, {type:'p', color:'w'}, {type:'p', color:'w'},
    {type:'r', color:'w'}, {type:'n', color:'w'}, {type:'b', color:'w'}, {type:'q', color:'w'}, {type:'k', color:'w'}, {type:'b', color:'w'}, {type:'n', color:'w'}, {type:'r', color:'w'}
];

// --- UTILS ---

const getValidMoves = (board: ChessPiece[], index: number): number[] => {
    const piece = board[index];
    if (!piece) return [];
    const moves: number[] = [];
    const row = Math.floor(index / 8);
    const col = index % 8;

    const isEnemy = (idx: number) => board[idx] && board[idx]?.color !== piece.color;
    const isEmpty = (idx: number) => !board[idx];

    const slidingMoves = (dirs: number[][]) => {
        dirs.forEach(([dr, dc]) => {
            let r = row + dr;
            let dc_ = col + dc;
            while (r >= 0 && r < 8 && dc_ >= 0 && dc_ < 8) {
                const i = r * 8 + dc_;
                if (isEmpty(i)) { moves.push(i); r += dr; dc_ += dc; }
                else { if (isEnemy(i)) moves.push(i); break; }
            }
        });
    };

    if (piece.type === 'p') {
        const dir = piece.color === 'w' ? -1 : 1;
        const f1 = index + dir * 8;
        if (f1 >= 0 && f1 < 64 && isEmpty(f1)) {
            moves.push(f1);
            const startRow = piece.color === 'w' ? 6 : 1;
            const f2 = index + dir * 16;
            if (row === startRow && isEmpty(f2)) moves.push(f2);
        }
        [dir * 8 - 1, dir * 8 + 1].forEach(offset => {
            const i = index + offset;
            if (i >= 0 && i < 64 && Math.abs((i % 8) - col) === 1 && isEnemy(i)) moves.push(i);
        });
    } else if (piece.type === 'n') {
        [[-2,-1], [-2,1], [-1,-2], [-1,2], [1,-2], [1,2], [2,-1], [2,1]].forEach(([dr, dc]) => {
            const r = row + dr, c = col + dc;
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const i = r * 8 + c;
                if (isEmpty(i) || isEnemy(i)) moves.push(i);
            }
        });
    } else if (piece.type === 'r') slidingMoves([[0,1],[0,-1],[1,0],[-1,0]]);
    else if (piece.type === 'b') slidingMoves([[1,1],[1,-1],[-1,1],[-1,-1]]);
    else if (piece.type === 'q') slidingMoves([[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]);
    else if (piece.type === 'k') {
        [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr, dc]) => {
            const r = row + dr, c = col + dc;
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const i = r * 8 + c;
                if (isEmpty(i) || isEnemy(i)) moves.push(i);
            }
        });
    }
    return moves;
};

// --- FASTA COMPONENT ---

const FastaGame = ({ lobbyId, lobbyData }: { lobbyId: string, lobbyData: any }) => {
    const [user] = useAuthState(auth);
    const { toast } = useToast();
    const [wordTimeLeft, setWordTimerLeft] = useState(0);
    const [isWinnerPickerOpen, setIsWinnerPickerOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const timeoutTriggeredRef = useRef(false);

    const config = lobbyData.fastaConfig || {};
    const state = lobbyData.gameState || {};
    const participants = lobbyData.participants || [];
    const isTeams = config.mode === 'teams';

    const currentDescriberUid = isTeams 
        ? config.teams?.[config.currentTeamIdx]?.members?.[config.currentMemberIdx?.[config.currentTeamIdx] || 0]
        : participants[config.currentDescriberIdx]?.uid;

    const isDescriber = user?.uid === currentDescriberUid;

    // --- LOGIC HOISTED TO TOP TO PREVENT BUILD ERRORS ---

    const drawWord = useCallback((usedWords: string[], deckKey: string) => {
        const deck = FASTA_WORDS[deckKey] || FASTA_WORDS.campus;
        const filtered = deck.filter(w => !usedWords.includes(w));
        return filtered[Math.floor(Math.random() * filtered.length)] || deck[0];
    }, []);

    const handleNext = useCallback(async (isTimeout = false) => {
        if (!isDescriber || isProcessing) return;
        setIsProcessing(true);

        try {
            await runTransaction(db, async (transaction) => {
                const lobbyRef = doc(db, 'game_lobbies', lobbyId);
                const freshLobby = await transaction.get(lobbyRef);
                const lData = freshLobby.data();
                if (!lData) return;

                const curIdx = lData.gameState?.currentWordIdx || 0;
                const nextWordIdx = curIdx + 1;
                const isTurnOver = nextWordIdx >= 5;
                const usedWords = [...(lData.gameState?.wordsUsed || [])];

                const updates: any = {
                    'gameState.currentWord': drawWord(usedWords, lData.fastaConfig?.wordDeck || 'campus'),
                    'gameState.wordTimerStart': serverTimestamp(),
                    'gameState.wordsUsed': arrayUnion(lData.gameState.currentWord)
                };

                if (isTurnOver) {
                    updates['gameState.currentWordIdx'] = 0;
                    if (lData.fastaConfig.mode === 'teams') {
                        const nextTeam = (lData.fastaConfig.currentTeamIdx + 1) % lData.fastaConfig.teams.length;
                        const nextMemberIdxs = { ...(lData.fastaConfig.currentMemberIdx || {}) };
                        nextMemberIdxs[nextTeam] = ((nextMemberIdxs[nextTeam] || 0) + 1) % lData.fastaConfig.teams[nextTeam].members.length;
                        updates['fastaConfig.currentTeamIdx'] = nextTeam;
                        updates['fastaConfig.currentMemberIdx'] = nextMemberIdxs;
                    } else {
                        updates['fastaConfig.currentDescriberIdx'] = (lData.fastaConfig.currentDescriberIdx + 1) % lData.participants.length;
                    }
                } else {
                    updates['gameState.currentWordIdx'] = nextWordIdx;
                }

                transaction.update(lobbyRef, updates);
            });
            if (!isTimeout) toast({ title: "Skipped" });
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    }, [isDescriber, isProcessing, lobbyId, toast, drawWord]);

    const applyPoint = useCallback(async (winnerUid: string | null) => {
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            await runTransaction(db, async (transaction) => {
                const lobbyRef = doc(db, 'game_lobbies', lobbyId);
                const freshLobby = await transaction.get(lobbyRef);
                const lData = freshLobby.data();
                if (!lData) return;

                const curIdx = lData.gameState?.currentWordIdx || 0;
                const nextWordIdx = curIdx + 1;
                const isTurnOver = nextWordIdx >= 5;

                const newScores = { ...(lData.fastaConfig?.scores || {}) };
                const newTeamScores = [...(lData.fastaConfig?.teams || [])];
                const usedWords = [...(lData.gameState?.wordsUsed || [])];

                if (lData.fastaConfig?.mode === 'teams') {
                    newTeamScores[lData.fastaConfig.currentTeamIdx].score += 1;
                } else if (winnerUid) {
                    newScores[winnerUid] = (newScores[winnerUid] || 0) + 1;
                    newScores[user!.uid] = (newScores[user!.uid] || 0) + 1; 
                }

                const updates: any = {
                    'gameState.currentWord': drawWord(usedWords, lData.fastaConfig?.wordDeck || 'campus'),
                    'gameState.wordTimerStart': serverTimestamp(),
                    'gameState.wordsUsed': arrayUnion(lData.gameState.currentWord),
                    'fastaConfig.scores': newScores,
                    'fastaConfig.teams': newTeamScores
                };

                if (isTurnOver) {
                    updates['gameState.currentWordIdx'] = 0;
                    if (lData.fastaConfig.mode === 'teams') {
                        const nextTeamIdx = (lData.fastaConfig.currentTeamIdx + 1) % newTeamScores.length;
                        const nextMemberIdxs = { ...(lData.fastaConfig.currentMemberIdx || {}) };
                        nextMemberIdxs[nextTeamIdx] = ((nextMemberIdxs[nextTeamIdx] || 0) + 1) % newTeamScores[nextTeamIdx].members.length;
                        updates['fastaConfig.currentTeamIdx'] = nextTeamIdx;
                        updates['fastaConfig.currentMemberIdx'] = nextMemberIdxs;
                    } else {
                        updates['fastaConfig.currentDescriberIdx'] = (lData.fastaConfig.currentDescriberIdx + 1) % lData.participants.length;
                    }
                } else {
                    updates['gameState.currentWordIdx'] = nextWordIdx;
                }

                transaction.update(lobbyRef, updates);
            });
            setIsWinnerPickerOpen(false);
            toast({ title: "Point Awarded!" });
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    }, [isProcessing, lobbyId, user, toast, drawWord]);

    const handleCorrect = useCallback(async () => {
        if (!isDescriber || isProcessing) return;
        if (isTeams) {
            await applyPoint(null);
        } else {
            setIsWinnerPickerOpen(true);
        }
    }, [isDescriber, isProcessing, isTeams, applyPoint]);

    // --- EFFECTS ---

    useEffect(() => {
        timeoutTriggeredRef.current = false;
    }, [state.currentWordIdx]);

    useEffect(() => {
        if (lobbyData.status !== 'playing' || !state.wordTimerStart) return;
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - state.wordTimerStart.toMillis()) / 1000);
            const remaining = Math.max(0, config.timerPerWord - elapsed);
            setWordTimerLeft(remaining);
            
            if (remaining === 0 && isDescriber && !timeoutTriggeredRef.current && !isProcessing) {
                timeoutTriggeredRef.current = true;
                handleNext(true);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [state.wordTimerStart, config.timerPerWord, isDescriber, isProcessing, handleNext]);

    const handleFlag = async () => {
        await addDoc(collection(db, 'game_lobbies', lobbyId, 'chat'), {
            text: `🚩 FLAG! ${user?.displayName} thinks the Describer broke the rules!`,
            sender: "System",
            timestamp: serverTimestamp()
        });
        toast({ title: "Rule Break Flagged!" });
    };

    return (
        <div className="flex flex-col items-center gap-6 sm:gap-8 py-4 sm:py-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-full max-w-2xl flex flex-wrap justify-center gap-3 sm:gap-4">
                {isTeams ? config.teams?.map((t: any, i: number) => (
                    <Card key={i} className={cn("p-3 sm:p-4 rounded-[1.5rem] sm:rounded-3xl border-none shadow-sm flex items-center gap-3 sm:gap-4", config.currentTeamIdx === i && "ring-4 ring-yellow-400 bg-yellow-50")}>
                        <Users2 className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
                        <div className="text-left">
                            <p className="text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground">{t.name}</p>
                            <p className="text-xl sm:text-2xl font-black text-yellow-600 leading-none">{t.score}</p>
                        </div>
                    </Card>
                )) : (
                    <div className="flex gap-2 overflow-x-auto p-2 scrollbar-hide">
                        {participants.map((p: any) => (
                            <div key={p.uid} className={cn("flex flex-col items-center gap-1 p-2 rounded-2xl transition-all", p.uid === currentDescriberUid && "bg-yellow-400/20")}>
                                <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border-2 border-white shadow-sm"><AvatarImage src={p.avatar}/></Avatar>
                                <span className="text-[9px] sm:text-[10px] font-black text-muted-foreground">{config.scores?.[p.uid] || 0}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Card className="w-full max-w-md rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-10 border-none shadow-2xl bg-gradient-to-br from-yellow-500 to-yellow-600 text-white text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 sm:p-8 opacity-10"><Zap className="h-24 w-24 sm:h-32 sm:w-32" /></div>
                
                <div className="space-y-4 sm:space-y-6 relative z-10">
                    <div className="flex justify-center items-center gap-3 sm:gap-4">
                        <Badge variant="outline" className="text-white border-white/40 font-black text-[9px] sm:text-[10px] px-3 sm:px-4 py-1 uppercase tracking-widest">
                            Word {state.currentWordIdx + 1} of 5
                        </Badge>
                        <div className="flex items-center gap-2 text-xl sm:text-2xl font-black tabular-nums">
                            <Clock className="h-5 w-5 sm:h-6 sm:w-6" /> {wordTimeLeft}s
                        </div>
                    </div>

                    <div className="h-32 sm:h-40 flex flex-col items-center justify-center">
                        {isDescriber ? (
                            <div className="animate-in zoom-in duration-500">
                                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-white/70 mb-2">The Secret Word is</p>
                                <h2 className="text-4xl sm:text-6xl font-black tracking-tighter drop-shadow-xl">{state.currentWord}</h2>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white/20 flex items-center justify-center mx-auto animate-pulse">
                                    <Eye className="h-5 w-5 sm:h-6 sm:w-6" />
                                </div>
                                <p className="text-lg sm:text-xl font-black uppercase tracking-tight">Listen Closely!</p>
                                <p className="text-xs sm:text-sm font-medium text-white/80">@{participants.find((p:any)=>p.uid===currentDescriberUid)?.name} is describing...</p>
                            </div>
                        )}
                    </div>

                    {isDescriber ? (
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <Button onClick={handleCorrect} disabled={isProcessing} className="h-10 sm:h-12 rounded-2xl bg-white text-yellow-600 hover:bg-white/90 font-black text-lg shadow-xl">
                                {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 mr-1.5 sm:mr-2" />}
                                CORRECT
                            </Button>
                            <Button onClick={() => handleNext()} variant="ghost" disabled={isProcessing} className="h-10 sm:h-12 rounded-2xl text-white hover:bg-white/20 font-black text-lg">
                                {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <SkipForward className="h-5 w-5 sm:h-6 sm:w-6 mr-1.5 sm:mr-2" />}
                                NEXT
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={handleFlag} variant="outline" className="w-full h-10 sm:h-12 rounded-2xl border-white/40 text-white hover:bg-white/20 font-black uppercase text-[10px] tracking-widest">
                            <Flag className="h-4 w-4 mr-2" /> Flag Rule Break
                        </Button>
                    )}
                </div>
            </Card>

            <Dialog open={isWinnerPickerOpen} onOpenChange={setIsWinnerPickerOpen}>
                <DialogContent className="rounded-[2rem] sm:rounded-[2.5rem]">
                    <DialogHeader>
                        <DialogTitle className="text-xl sm:text-2xl font-black">Who guessed correctly?</DialogTitle>
                        <DialogDescription className="text-sm font-medium">Assign points based on who spoke first.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[300px] my-4">
                        <div className="grid grid-cols-2 gap-3 p-2">
                            {participants.filter((p:any)=>p.uid !== user?.uid).map((p: any) => (
                                <Button key={p.uid} onClick={() => applyPoint(p.uid)} disabled={isProcessing} variant="outline" className="h-16 sm:h-20 rounded-xl sm:rounded-2xl flex flex-col gap-1 sm:gap-2 font-bold hover:bg-yellow-50">
                                    <Avatar className="h-7 w-7 sm:h-8 sm:w-8"><AvatarImage src={p.avatar}/></Avatar>
                                    <span className="truncate w-full text-[10px] sm:text-xs">@{p.username}</span>
                                </Button>
                            ))}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
};

// --- CHESS COMPONENT ---

const ChessGame = ({ lobbyId, lobbyData }: { lobbyId: string, lobbyData: any }) => {
    const [user] = useAuthState(auth);
    const [board, setBoard] = useState<ChessPiece[]>(INITIAL_BOARD);
    const [turn, setTurn] = useState<'w' | 'b'>('w');
    const [selected, setSelected] = useState<number | null>(null);
    const [validMoves, setValidMoves] = useState<number[]>([]);
    const [timers, setTimers] = useState({ w: 600, b: 600 });
    const [isProcessing, setIsProcessing] = useState(false);

    const whitePlayer = lobbyData.participants?.find((p: any) => p.uid === lobbyData.assignedWhite);
    const blackPlayer = lobbyData.participants?.find((p: any) => p.uid === lobbyData.assignedBlack);
    const playerColor = user?.uid === lobbyData.assignedWhite ? 'w' : user?.uid === lobbyData.assignedBlack ? 'b' : null;

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'game_lobbies', lobbyId), (doc) => {
            const data = doc.data();
            if (data?.gameState?.board) {
                setBoard(data.gameState.board);
                setTurn(data.gameState.turn);
                setTimers(data.gameState.timers || { w: 600, b: 600 });
            }
        });
        return () => unsub();
    }, [lobbyId]);

    useEffect(() => {
        if (lobbyData.status !== 'playing') return;
        const interval = setInterval(() => {
            setTimers(prev => {
                const updatedTime = Math.max(0, prev[turn] - 1);
                return { ...prev, [turn]: updatedTime };
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [turn, lobbyData.status]);

    const handleCellClick = async (index: number) => {
        if (!playerColor || turn !== playerColor || isProcessing) return;
        
        if (selected !== null && validMoves.includes(index)) {
            setIsProcessing(true);
            try {
                await runTransaction(db, async (transaction) => {
                    const lobbyRef = doc(db, 'game_lobbies', lobbyId);
                    const freshLobby = await transaction.get(lobbyRef);
                    const lData = freshLobby.data();
                    if (!lData) return;

                    const newBoard = [...lData.gameState.board];
                    newBoard[index] = newBoard[selected];
                    newBoard[selected] = null;
                    
                    transaction.update(lobbyRef, {
                        'gameState.board': newBoard,
                        'gameState.turn': turn === 'w' ? 'b' : 'w',
                        'gameState.lastMoveAt': serverTimestamp(),
                        'gameState.timers': timers
                    });
                });
                setSelected(null);
                setValidMoves([]);
            } catch (e) {
                console.error(e);
            } finally {
                setIsProcessing(false);
            }
        } else {
            const piece = board[index];
            if (piece && piece.color === playerColor) {
                setSelected(index);
                setValidMoves(getValidMoves(board, index));
            } else {
                setSelected(null);
                setValidMoves([]);
            }
        }
    };

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    const getPieceIcon = (piece: ChessPiece) => {
        if (!piece) return null;
        const symbols: any = { 
            p: '\u265F\uFE0E', // Pawn
            r: '\u265C\uFE0E', // Rook
            n: '\u265E\uFE0E', // Knight
            b: '\u265D\uFE0E', // Bishop
            q: '\u265B\uFE0E', // Queen
            k: '\u265A\uFE0E'  // King
        };
        return (
            <span className={cn(
                "text-4xl sm:text-5xl select-none transition-transform active:scale-110", 
                piece.color === 'w' ? "text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.4)]" : "text-slate-900"
            )}>
                {symbols[piece.type]}
            </span>
        );
    };

    return (
        <div className="flex flex-col items-center gap-4 sm:gap-6 py-2 sm:py-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex justify-between w-full max-w-[480px] px-2 sm:px-4">
                <div className="flex flex-col items-center gap-1 text-center min-w-[80px] sm:min-w-[100px]">
                    <p className="text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground truncate w-20 sm:w-auto">{whitePlayer?.name || 'Open Seat'}</p>
                    <div className="flex items-center gap-1 sm:gap-2">
                        <span className="text-[12px] sm:text-[14px] font-black tabular-nums text-[#b58863]">{formatTime(timers.w)}</span>
                        <Badge variant={turn === 'w' ? 'default' : 'outline'} className={cn("text-[8px] px-1.5 h-4 sm:h-5 sm:text-xs", turn === 'w' && "bg-[#b58863] text-white border-[#b58863]")}>White</Badge>
                    </div>
                </div>
                <Separator orientation="vertical" className="h-8 sm:h-10" />
                <div className="flex flex-col items-center gap-1 text-center min-w-[80px] sm:min-w-[100px]">
                    <p className="text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground truncate w-20 sm:w-auto">{blackPlayer?.name || 'Open Seat'}</p>
                    <div className="flex items-center gap-1 sm:gap-2">
                        <span className="text-[12px] sm:text-[14px] font-black tabular-nums text-slate-900">{formatTime(timers.b)}</span>
                        <Badge variant={turn === 'b' ? 'default' : 'outline'} className={cn("text-[8px] px-1.5 h-4 sm:h-5 sm:text-xs", turn === 'b' && "bg-slate-900 text-white border-slate-900")}>Black</Badge>
                    </div>
                </div>
            </div>

            <div className="relative border-8 sm:border-[12px] border-[#7d5b3d] shadow-2xl rounded-sm overflow-hidden aspect-square w-full max-w-[480px] bg-[#f0d9b5]">
                <div className="grid grid-cols-8 grid-rows-8 h-full w-full">
                    {board.map((piece, idx) => {
                        const row = Math.floor(idx / 8), col = idx % 8;
                        const isDark = (row + col) % 2 === 1;
                        const isValidMove = validMoves.includes(idx);
                        const isCapture = isValidMove && board[idx] !== null;

                        return (
                            <div key={idx} onClick={() => handleCellClick(idx)} className={cn("relative flex items-center justify-center cursor-pointer transition-all aspect-square", isDark ? "bg-[#b58863]" : "bg-[#f0d9b5]", selected === idx && "bg-yellow-400/80 scale-105 z-10", isValidMove && !isCapture && "hover:bg-primary/20", isCapture && "hover:bg-red-500/30")}>
                                {getPieceIcon(piece)}
                                {isValidMove && (
                                    <div className={cn("absolute z-10 rounded-full", isCapture ? "w-[85%] h-[85%] border-2 sm:border-4 border-red-500/60 animate-pulse" : "w-2 h-2 sm:w-4 sm:h-4 bg-green-600/40")} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex items-center gap-3">
                {turn === playerColor ? (
                    <div className="bg-primary text-primary-foreground font-black text-[9px] sm:text-[10px] uppercase px-6 sm:px-8 py-2 sm:py-2.5 rounded-full animate-pulse shadow-lg">Your Turn</div>
                ) : !playerColor ? (
                    <div className="bg-muted text-muted-foreground font-black text-[9px] sm:text-[10px] uppercase px-6 sm:px-8 py-2 sm:py-2.5 rounded-full border border-dashed"><Eye className="h-3 w-3 inline mr-1.5 sm:mr-2" /> Spectating</div>
                ) : (
                    <div className="bg-muted/50 text-muted-foreground font-black text-[9px] sm:text-[10px] uppercase px-6 sm:px-8 py-2 sm:py-2.5 rounded-full border">Opponent's Turn</div>
                )}
            </div>
        </div>
    );
};

// --- MULTIPLAYER LOBBY ---

const MultiplayerLobby = ({ gameId, gameName, onBack }: { gameId: string, gameName: string, onBack: () => void }) => {
    const [user] = useAuthState(auth);
    const { toast } = useToast();
    const [activeLobby, setActiveLobby] = useState<any>(null);
    const [lobbies, setLobbies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [chat, setChat] = useState<any[]>([]);
    const [msg, setMsg] = useState('');

    const [fastaMode, setFastaMode] = useState<'teams' | 'individual'>('individual');
    const [fastaDeck, setFastaDeck] = useState('campus');
    const [matchDuration, setMatchDuration] = useState('600');
    const [teamAssignments, setTeamAssignments] = useState<Record<string, number>>({});

    useEffect(() => {
        const q = query(collection(db, 'game_lobbies'), where('gameId', '==', gameId), where('status', 'in', ['waiting', 'playing']), limit(15));
        return onSnapshot(q, (snap) => {
            const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setLobbies(fetched);
            setLoading(false);
            if (user) {
                const myLobby = fetched.find((l: any) => l.participants_uids?.includes(user.uid));
                if (myLobby) setActiveLobby(myLobby);
                else setActiveLobby(null);
            }
        });
    }, [gameId, user]);

    useEffect(() => {
        if (!activeLobby) return;
        const q = query(collection(db, 'game_lobbies', activeLobby.id, 'chat'), orderBy('timestamp', 'asc'), limit(30));
        return onSnapshot(q, (snap) => setChat(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, [activeLobby?.id]);

    const handleCreate = async () => {
        if (!user) return;
        try {
            const userSnap = await getDoc(doc(db, 'users', user.uid));
            const userData = userSnap.data();
            const initialLobby: any = {
                gameId, gameName, matchType: 'online',
                creator: { uid: user.uid, name: userData?.name || user.displayName, username: userData?.username || 'student', avatar: userData?.avatar || user.photoURL },
                participants: [{ uid: user.uid, name: userData?.name || user.displayName, username: userData?.username, avatar: userData?.avatar || user.photoURL }],
                participants_uids: [user.uid],
                status: 'waiting', timestamp: serverTimestamp(),
            };

            if (gameId === 'chess') {
                initialLobby.assignedWhite = null;
                initialLobby.assignedBlack = null;
                initialLobby.gameState = { board: INITIAL_BOARD, turn: 'w', timers: { w: 600, b: 600 } };
            } else if (gameId === 'fasta') {
                initialLobby.fastaConfig = { 
                    mode: fastaMode, 
                    wordDeck: fastaDeck, 
                    timerPerWord: 25, 
                    scores: {}, 
                    teams: [
                        { name: 'Team Alpha', members: [], score: 0 },
                        { name: 'Team Omega', members: [], score: 0 }
                    ],
                    currentDescriberIdx: 0,
                    currentTeamIdx: 0,
                    currentMemberIdx: { 0: 0, 1: 0 }
                };
                initialLobby.gameState = { currentWordIdx: 0, currentWord: "", wordsUsed: [] };
            }

            await addDoc(collection(db, 'game_lobbies'), initialLobby);
            toast({ title: "Room Created!" });
        } catch (e) { toast({ variant: 'destructive', title: "Error" }); }
    };

    const handleJoin = async (lobby: any) => {
        if (!user || lobby.participants_uids?.includes(user.uid)) { setActiveLobby(lobby); return; }
        try {
            const userSnap = await getDoc(doc(db, 'users', user.uid));
            const userData = userSnap.data();
            await updateDoc(doc(db, 'game_lobbies', lobby.id), {
                participants: arrayUnion({ uid: user.uid, name: userData?.name || user.displayName, username: userData?.username, avatar: userData?.avatar || user.photoURL }),
                participants_uids: arrayUnion(user.uid)
            });
        } catch (e) {}
    };

    const handleLeave = async () => {
        if (!activeLobby || !user) return;
        try {
            if (activeLobby.creator.uid === user.uid) {
                await deleteDoc(doc(db, 'game_lobbies', activeLobby.id));
            } else {
                await updateDoc(doc(db, 'game_lobbies', activeLobby.id), {
                    participants: arrayRemove(activeLobby.participants.find((p: any) => p.uid === user.uid)),
                    participants_uids: arrayRemove(user.uid)
                });
            }
            setActiveLobby(null);
        } catch (e) {
            console.error(e);
        }
    };

    const handleStart = async () => {
        if (!activeLobby || activeLobby.creator.uid !== user?.uid) return;
        
        if (gameId === 'fasta') {
            if (fastaMode === 'individual' && activeLobby.participants.length < 2) {
                toast({ variant: 'destructive', title: "Not enough players", description: "At least 2 students required for Individual mode." });
                return;
            }
            if (fastaMode === 'teams') {
                const team0 = activeLobby.participants.filter((p:any) => teamAssignments[p.uid] === 0);
                const team1 = activeLobby.participants.filter((p:any) => teamAssignments[p.uid] === 1);
                if (team0.length < 2 || team1.length < 2) {
                    toast({ variant: 'destructive', title: "Incomplete Teams", description: "Each team needs at least 2 members." });
                    return;
                }
            }
        }

        const updates: any = { status: 'playing' };

        if (gameId === 'chess') {
            const dur = parseInt(matchDuration);
            updates['gameState.timers'] = { w: dur, b: dur };
        } else if (gameId === 'fasta') {
            const deck = FASTA_WORDS[fastaDeck] || FASTA_WORDS.campus;
            const firstWord = deck[Math.floor(Math.random() * deck.length)];
            updates['gameState.currentWord'] = firstWord;
            updates['gameState.wordTimerStart'] = serverTimestamp();
            updates['gameState.wordsUsed'] = [firstWord];
            
            if (fastaMode === 'teams') {
                const team0Uids = activeLobby.participants.filter((p:any) => teamAssignments[p.uid] === 0).map((p:any) => p.uid);
                const team1Uids = activeLobby.participants.filter((p:any) => teamAssignments[p.uid] === 1).map((p:any) => p.uid);
                updates['fastaConfig.teams'] = [
                    { name: 'Team Alpha', members: team0Uids, score: 0 },
                    { name: 'Team Omega', members: team1Uids, score: 0 }
                ];
            }
            updates['fastaConfig.mode'] = fastaMode;
            updates['fastaConfig.wordDeck'] = fastaDeck;
        }

        await updateDoc(doc(db, 'game_lobbies', activeLobby.id), updates);
        toast({ title: "Match Started!" });
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !msg.trim() || !activeLobby) return;
        await addDoc(collection(db, 'game_lobbies', activeLobby.id, 'chat'), { 
            text: msg, 
            sender: user.displayName || 'Student', 
            senderUid: user.uid, 
            timestamp: serverTimestamp() 
        });
        setMsg('');
    };

    const toggleTeam = (uid: string) => {
        setTeamAssignments(prev => ({
            ...prev,
            [uid]: prev[uid] === 0 ? 1 : 0
        }));
    };

    if (activeLobby) {
        const isHost = activeLobby.creator?.uid === user?.uid;
        const isPlaying = activeLobby.status === 'playing';

        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 pb-20">
                <Card className="lg:col-span-2 rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden flex flex-col min-h-[500px] sm:min-h-[600px] border-none shadow-sm bg-card">
                    <CardHeader className="bg-primary/5 p-4 sm:p-6 border-b">
                        <div className="flex justify-between items-center mb-3 sm:mb-4">
                            <Button variant="ghost" size="sm" onClick={onBack} className="rounded-full gap-1 sm:gap-2 font-bold h-9 sm:h-10 px-3 sm:px-4 hover:bg-primary/10 text-[10px] sm:text-xs">
                                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Library
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleLeave} className="text-destructive font-black uppercase text-[8px] sm:text-[10px] tracking-widest border-destructive/20 rounded-full h-9 sm:h-10 px-4 sm:px-6 hover:bg-destructive hover:text-white transition-all">
                                {isHost ? "End Session" : "Leave Room"}
                            </Button>
                        </div>
                        <div className="flex items-center gap-3 sm:gap-4">
                            <Badge className="rounded-full bg-primary text-white font-black uppercase tracking-widest px-3 sm:px-4 py-1 text-[8px] sm:text-[10px]">
                                ONLINE {(gameName || "MATCH").toUpperCase()}
                            </Badge>
                            <span className="text-[9px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest">ID: {activeLobby.id.substring(0,6)}</span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-8 flex-1">
                        {!isPlaying ? (
                            <div className="space-y-6 sm:space-y-10 py-4 sm:py-6">
                                <div className="text-center">
                                    <h3 className="text-lg sm:text-xl font-black uppercase tracking-tighter text-primary">Match Setup</h3>
                                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">Configure rules and participants.</p>
                                </div>

                                <div className="space-y-3 sm:space-y-4">
                                    <h4 className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1 sm:px-2">Lobby Members ({activeLobby.participants?.length})</h4>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
                                        {activeLobby.participants?.map((p: any) => (
                                            <div key={p.uid} className="flex flex-col items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-muted/20 border border-primary/5 animate-in fade-in zoom-in duration-300">
                                                <div className="relative">
                                                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border-2 border-white shadow-sm"><AvatarImage src={p.avatar}/></Avatar>
                                                    {p.uid === activeLobby.creator.uid && <div className="absolute -top-1 -right-1 bg-yellow-400 text-white rounded-full p-0.5"><Trophy className="h-2 w-2" /></div>}
                                                </div>
                                                <span className="text-[8px] sm:text-[9px] font-black truncate w-full text-center">@{p.username || p.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {gameId === 'chess' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 max-w-2xl mx-auto">
                                        <div className={cn("p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border-2 sm:border-4 transition-all flex flex-col items-center gap-3 sm:gap-4", activeLobby.assignedWhite ? "border-primary/40 bg-primary/5" : "border-dashed border-muted-foreground/20")}>
                                            <p className="text-[8px] sm:text-[10px] font-black uppercase text-primary tracking-widest">White</p>
                                            <p className="font-bold text-base sm:text-lg">{activeLobby.assignedWhite ? activeLobby.participants.find((p:any)=>p.uid === activeLobby.assignedWhite)?.name : "Waiting..."}</p>
                                            {isHost && (
                                                <Select onValueChange={(v) => updateDoc(doc(db, 'game_lobbies', activeLobby.id), { assignedWhite: v })}>
                                                    <SelectTrigger className="rounded-xl h-9 sm:h-10 border-none bg-white shadow-sm text-xs"><SelectValue placeholder="Assign"/></SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        {activeLobby.participants.map((p:any) => <SelectItem key={p.uid} value={p.uid} className="text-xs">{p.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                        <div className={cn("p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border-2 sm:border-4 transition-all flex flex-col items-center gap-3 sm:gap-4", activeLobby.assignedBlack ? "border-slate-900/40 bg-slate-900/5" : "border-dashed border-muted-foreground/20")}>
                                            <p className="text-[8px] sm:text-[10px] font-black uppercase text-slate-900 tracking-widest">Black</p>
                                            <p className="font-bold text-base sm:text-lg">{activeLobby.assignedBlack ? activeLobby.participants.find((p:any)=>p.uid === activeLobby.assignedBlack)?.name : "Waiting..."}</p>
                                            {isHost && (
                                                <Select onValueChange={(v) => updateDoc(doc(db, 'game_lobbies', activeLobby.id), { assignedBlack: v })}>
                                                    <SelectTrigger className="rounded-xl h-9 sm:h-10 border-none bg-slate-900 text-white shadow-sm text-xs"><SelectValue placeholder="Assign"/></SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        {activeLobby.participants.map((p:any) => <SelectItem key={p.uid} value={p.uid} className="text-xs">{p.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {gameId === 'fasta' && (
                                    <div className="space-y-6 sm:space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-xl mx-auto">
                                            <div className="space-y-1.5 sm:space-y-2">
                                                <Label className="text-[9px] sm:text-[10px] font-black uppercase">Play Mode</Label>
                                                <Select value={fastaMode} onValueChange={(v:any) => setFastaMode(v)} disabled={!isHost}>
                                                    <SelectTrigger className="rounded-xl h-11 sm:h-12 bg-muted/20 border-none font-bold text-xs"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="individual" className="font-bold text-xs">Individual (2+ Players)</SelectItem>
                                                        <SelectItem value="teams" className="font-bold text-xs">Teams (4+ Players)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5 sm:space-y-2">
                                                <Label className="text-[9px] sm:text-[10px] font-black uppercase">Word Deck</Label>
                                                <Select value={fastaDeck} onValueChange={setFastaDeck} disabled={!isHost}>
                                                    <SelectTrigger className="rounded-xl h-11 sm:h-12 bg-muted/20 border-none font-bold text-xs"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="campus" className="font-bold text-xs">Campus Life</SelectItem>
                                                        <SelectItem value="uganda" className="font-bold text-xs">Ugandan Pop</SelectItem>
                                                        <SelectItem value="general" className="font-bold text-xs">General</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {fastaMode === 'teams' && isHost && (
                                            <Card className="max-w-2xl mx-auto rounded-2xl sm:rounded-[2rem] border-none shadow-sm bg-muted/10 p-4 sm:p-6 space-y-3 sm:space-y-4">
                                                <div className="text-center">
                                                    <h4 className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary mb-1">Assign Teams</h4>
                                                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Toggle students to balance teams.</p>
                                                </div>
                                                <div className="space-y-2">
                                                    {activeLobby.participants?.map((p: any) => (
                                                        <div key={p.uid} className="flex items-center justify-between p-2 sm:p-3 bg-white rounded-lg sm:rounded-xl shadow-sm">
                                                            <div className="flex items-center gap-2 sm:gap-3">
                                                                <Avatar className="h-7 w-7 sm:h-8 sm:w-8"><AvatarImage src={p.avatar}/></Avatar>
                                                                <span className="text-[10px] sm:text-xs font-bold">@{p.username || p.name}</span>
                                                            </div>
                                                            <Button 
                                                                variant={teamAssignments[p.uid] === 1 ? "default" : "outline"} 
                                                                size="sm" 
                                                                onClick={() => toggleTeam(p.uid)}
                                                                className={cn(
                                                                    "rounded-full h-7 sm:h-8 px-3 sm:px-4 font-black uppercase text-[7px] sm:text-[8px] tracking-widest transition-all",
                                                                    teamAssignments[p.uid] === 1 ? "bg-accent hover:bg-accent/90" : "text-primary border-primary/20"
                                                                )}
                                                            >
                                                                {teamAssignments[p.uid] === 1 ? "TEAM OMEGA" : "TEAM ALPHA"}
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>
                                        )}
                                    </div>
                                )}

                                <div className="max-w-xs mx-auto space-y-2 sm:space-y-3">
                                    <Label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center block">Match Timer Setting</Label>
                                    <Select value={matchDuration} onValueChange={setMatchDuration} disabled={!isHost}>
                                        <SelectTrigger className="rounded-xl h-11 sm:h-12 bg-muted/20 border-none font-bold text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="60" className="font-bold text-xs">Blitz (1 Min)</SelectItem>
                                            <SelectItem value="300" className="font-bold text-xs">Rapid (5 Min)</SelectItem>
                                            <SelectItem value="600" className="font-bold text-xs">Normal (10 Min)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex justify-center pt-4 sm:pt-6">
                                    <Button onClick={handleStart} disabled={!isHost} className="rounded-2xl h-12 sm:h-16 px-10 sm:px-16 font-black text-lg sm:text-xl bg-primary shadow-xl hover:scale-105 active:scale-95 transition-all">
                                        START GAME
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            gameId === 'chess' ? <ChessGame lobbyId={activeLobby.id} lobbyData={activeLobby} /> : <FastaGame lobbyId={activeLobby.id} lobbyData={activeLobby} />
                        )}
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] sm:rounded-[2.5rem] flex flex-col h-[400px] sm:h-[600px] overflow-hidden border-none shadow-sm bg-card">
                    <CardHeader className="bg-muted/30 p-4 sm:p-6 border-b"><CardTitle className="text-lg sm:text-xl font-black">Lobby Chat</CardTitle></CardHeader>
                    <ScrollArea className="flex-1 p-3 sm:p-4">
                        <div className="space-y-3 sm:space-y-4">
                            {chat.map(m => (
                                <div key={m.id} className={cn("flex flex-col", m.senderUid === user?.uid ? "items-end" : "items-start")}>
                                    <span className="text-[8px] sm:text-[9px] font-bold text-muted-foreground mb-0.5 sm:mb-1">{m.sender}</span>
                                    <div className={cn("px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl max-w-[90%] text-xs sm:text-sm font-medium", m.senderUid === user?.uid ? "bg-primary text-white" : "bg-muted")}>{m.text}</div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                    <form onSubmit={handleSend} className="p-3 sm:p-4 border-t flex gap-2">
                        <Input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Type a message..." className="rounded-xl bg-secondary/50 border-none h-10 sm:h-11 text-xs sm:text-sm" />
                        <Button type="submit" size="icon" className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl shrink-0"><Send className="h-4 w-4" /></Button>
                    </form>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-primary/10 h-10 w-10"><ArrowLeft className="h-5 w-5" /></Button>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tighter">{(gameName || "GAME").toUpperCase()} Arena</h2>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between items-center bg-primary/5 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-primary/10 gap-4 text-center sm:text-left">
                <div className="space-y-0.5 sm:space-y-1">
                    <h3 className="font-black text-xl sm:text-2xl text-primary uppercase leading-none">Open A Room</h3>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Host a lobby and wait for players to join.</p>
                </div>
                <Button onClick={handleCreate} className="w-full sm:w-auto rounded-full h-12 sm:h-14 px-10 sm:px-12 font-black bg-primary text-white shadow-xl hover:scale-105 active:scale-95 transition-all">
                    Create Match
                </Button>
            </div>

            {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary h-8 w-8 sm:h-10 sm:w-10"/></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {lobbies.map(l => (
                        <Card key={l.id} className="rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden bg-card shadow-sm hover:shadow-xl transition-all border-none group">
                            <CardHeader className="bg-primary/5 p-4 sm:p-5 flex flex-row items-center gap-3 sm:gap-4">
                                <Avatar className="h-10 w-10 sm:h-14 sm:w-14 border-2 border-primary/20"><AvatarImage src={l.creator?.avatar}/></Avatar>
                                <div>
                                    <CardTitle className="text-base sm:text-lg font-black leading-none">@{l.creator?.username}</CardTitle>
                                    <p className="text-[8px] sm:text-[9px] font-bold text-muted-foreground mt-1.5 sm:mt-2 uppercase tracking-wider flex items-center gap-1.5"><Users className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {l.participants_uids?.length} in lobby</p>
                                </div>
                            </CardHeader>
                            <CardFooter className="p-4 sm:p-5 border-t">
                                <Button onClick={() => handleJoin(l)} className="w-full rounded-xl sm:rounded-2xl font-black uppercase text-[8px] sm:text-[10px] tracking-widest h-10 sm:h-12 bg-primary text-white">Join Arena</Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- MAIN HUB PAGE ---

export default function MakGamesPage() {
    const [user] = useAuthState(auth);
    const { toast } = useToast();
    const [selectedGame, setSelectedGame] = useState<string | null>(null);
    const [activeLobbies, setActiveLobbies] = useState<any[]>([]);
    const [publicLobbies, setPublicLobbies] = useState<any[]>([]);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'game_lobbies'), where('participants_uids', 'array-contains', user.uid), where('status', 'in', ['waiting', 'playing']));
        return onSnapshot(q, (snap) => setActiveLobbies(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, [user]);

    useEffect(() => {
        const q = query(collection(db, 'game_lobbies'), where('status', '==', 'waiting'), limit(15));
        return onSnapshot(q, (snap) => {
            const lobbies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setPublicLobbies(lobbies.filter((l: any) => !user || !l.participants_uids?.includes(user.uid)));
        });
    }, [user]);

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-24 text-foreground">
            <header>
                <h1 className="text-3xl sm:text-5xl font-black font-headline tracking-tighter text-violet-600 flex items-center gap-2 sm:gap-3">MakGames <Gamepad2 className="h-8 w-8 sm:h-10 sm:w-10" /></h1>
                <p className="text-sm sm:text-muted-foreground font-medium mt-1.5 sm:mt-2">Makerere's digital playground. Play strategy, speed, and social games online.</p>
            </header>

            {selectedGame ? <MultiplayerLobby gameId={selectedGame} gameName={GAME_LIST.find(g => g.id === selectedGame)?.name || ''} onBack={() => setSelectedGame(null)} /> : (
                <>
                    {activeLobbies.length > 0 && (
                        <section className="space-y-3 sm:space-y-4">
                            <h3 className="text-[9px] sm:text-[10px] font-black uppercase text-primary/60 px-1 sm:px-2 flex items-center gap-1.5 sm:gap-2 animate-pulse"><Clock className="h-3 w-3" /> Resume Your Battles</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                {activeLobbies.map(l => (
                                    <Card key={l.id} onClick={() => setSelectedGame(l.gameId)} className="rounded-[1.5rem] sm:rounded-[2rem] border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all cursor-pointer flex items-center justify-between p-4 sm:p-5 group">
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform text-white"><Zap className="h-5 w-5 sm:h-6 sm:w-6 text-white"/></div>
                                            <div><p className="font-black text-base sm:text-lg uppercase leading-none">{l.gameName}</p><p className="text-[8px] sm:text-[9px] font-bold text-primary uppercase mt-1">{l.status === 'playing' ? 'Live Match' : 'In Lobby'}</p></div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 text-primary opacity-40 group-hover:translate-x-1 transition-transform"/>
                                    </Card>
                                ))}
                            </div>
                        </section>
                    )}

                    {publicLobbies.length > 0 && (
                        <section className="space-y-3 sm:space-y-4">
                            <h3 className="text-[9px] sm:text-[10px] font-black uppercase text-accent/60 px-1 sm:px-2 flex items-center gap-1.5 sm:gap-2"><Users className="h-3 w-3" /> Open Public Rooms</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                {publicLobbies.map(l => (
                                    <Card key={l.id} className="rounded-[1.5rem] sm:rounded-[2.5rem] border-none bg-card shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group">
                                        <div className="p-4 sm:p-6 flex items-center justify-between border-b border-muted/20">
                                            <div className="flex items-center gap-2 sm:gap-3">
                                                <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border-2 border-accent/20 group-hover:scale-105 transition-transform"><AvatarImage src={l.creator?.avatar}/></Avatar>
                                                <div><p className="font-black text-[10px] sm:text-xs uppercase text-accent leading-none">@{l.creator?.username}</p><p className="text-[8px] sm:text-[9px] font-bold text-muted-foreground uppercase mt-1">{l.gameName}</p></div>
                                            </div>
                                            <Button size="sm" onClick={() => setSelectedGame(l.gameId)} className="h-9 sm:h-10 rounded-full bg-accent hover:bg-accent/90 text-white font-black text-[8px] sm:text-[9px] uppercase px-6 sm:px-8 shadow-md">Join</Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="space-y-3 sm:space-y-4">
                        <h3 className="text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground/60 px-1 sm:px-2">Games Library</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                            {GAME_LIST.map(game => (
                                <Card key={game.id} className="group overflow-hidden rounded-[2rem] sm:rounded-[3rem] border-none shadow-sm hover:shadow-2xl transition-all bg-card flex flex-col h-full">
                                    <CardHeader className="pb-4 cursor-pointer p-6 sm:p-10" onClick={() => setSelectedGame(game.id)}>
                                        <div className={cn("h-12 w-12 sm:h-16 sm:w-16 rounded-2xl sm:rounded-3xl flex items-center justify-center text-white mb-4 sm:mb-8 shadow-xl transform group-hover:rotate-12 transition-all", game.color)}>
                                            <game.icon className="h-6 w-6 sm:h-8 sm:w-8" />
                                        </div>
                                        <CardTitle className="text-xl sm:text-3xl font-black tracking-tight">{game.name}</CardTitle>
                                        <CardDescription className="font-medium text-sm sm:text-base mt-1 sm:mt-2">{game.desc}</CardDescription>
                                    </CardHeader>
                                    <CardFooter className="p-6 sm:p-8 pt-0 mt-auto flex gap-3 sm:gap-4">
                                        <Button className="flex-1 h-12 sm:h-14 rounded-xl sm:rounded-2xl font-black uppercase text-[10px] sm:text-xs tracking-widest shadow-lg" onClick={() => setSelectedGame(game.id)}>Enter Arena</Button>
                                        <Button variant="outline" className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl border-2" onClick={() => toast({ title: game.name + " Rules", description: game.instructions, duration: 8000 })}>
                                            <BookOpen className="h-5 w-5 sm:h-6 sm:w-6"/>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
