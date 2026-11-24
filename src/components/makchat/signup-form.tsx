"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Lock, User, Loader2, UserPlus, AtSign, Eye, EyeOff, Hash, Fingerprint, ShieldCheck, ShieldAlert, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const formSchema = z.object({
  name: z.string().trim().min(2, { message: "Name must be at least 2 characters." }),
  username: z.string().trim().min(3, { message: "Username must be at least 3 characters."}).regex(/^[a-z0-9_.]+$/, "Username can only contain lowercase letters, numbers, underscores, and periods."),
  email: z.string().trim().email({ message: "Please enter a valid email." }),
  studentNumber: z.string().trim().regex(/^\d{10}$/, "Student Number must be exactly 10 digits."),
  registrationNumber: z.string().trim().min(5, { message: "Registration Number is required." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  confirmPassword: z.string().min(8, { message: "Please confirm your password." }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export function SignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupType, setSignupType] = useState<"webmail" | "personal">("personal");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      studentNumber: "",
      registrationNumber: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const trimmedEmail = values.email.trim();
    const isWebmail = trimmedEmail.toLowerCase().endsWith("@students.mak.ac.ug") || trimmedEmail.toLowerCase().endsWith("@mubs.ac.ug");
    
    if (signupType === "webmail" && !isWebmail) {
      form.setError("email", { message: "Please use your university email for this option." });
      return;
    }

    setIsSubmitting(true);
    try {
      const sanitizedUsername = values.username.trim().toLowerCase();
      const sanitizedName = values.name.trim();
      
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        trimmedEmail,
        values.password
      );
      
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: sanitizedName,
        photoURL: `https://picsum.photos/seed/${user.uid}/100`
      });

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: sanitizedName,
        email: trimmedEmail,
        username: sanitizedUsername,
        studentNumber: values.studentNumber.trim(),
        registrationNumber: values.registrationNumber.trim(),
        isVerified: false,
        isGreen: false,
        bio: `A new member of the MakChat community!`,
        college: 'Not specified',
        relationshipStatus: 'Not specified',
        hostelHall: 'Not specified',
        joined: new Date().toISOString(),
        avatar: `https://picsum.photos/seed/${user.uid}/100`,
        coverImage: 'https://picsum.photos/seed/cover/1200/400',
        online: true,
        lastSeen: serverTimestamp()
      });
      
      toast({
        title: "Account Created",
        description: "Welcome to MakChat! Your account has been successfully enrolled.",
      });
      router.push("/home");

    } catch (error: any) {
      console.error("Signup Error:", error);
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: error.code === 'auth/email-already-in-use' 
            ? "This email address is already in use."
            : "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
      <CardHeader className="text-center bg-muted/30 pb-8 pt-10">
        <CardTitle className="text-4xl font-black font-headline tracking-tighter">Join MakChat</CardTitle>
        <CardDescription className="font-medium text-lg">
          The Makerere University Student Network
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-8">
        <div className="space-y-6">
          <Tabs defaultValue="personal" onValueChange={(v) => setSignupType(v as any)} className="mb-4">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl h-14 p-1 bg-muted">
              <TabsTrigger value="personal" className="rounded-xl font-bold text-xs uppercase tracking-widest gap-2">
                <ShieldAlert className="h-4 w-4" /> Gmail / Other
              </TabsTrigger>
              <TabsTrigger value="webmail" className="rounded-xl font-bold text-xs uppercase tracking-widest gap-2">
                <ShieldCheck className="h-4 w-4" /> Webmail
              </TabsTrigger>
            </TabsList>
            
            <div className="mt-4 px-1">
               <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center">
                 {signupType === "webmail" 
                   ? "Enroll with your student email." 
                   : "Access via Gmail. Identification numbers required."}
               </p>
            </div>
          </Tabs>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Full Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="John Doe" {...field} className="pl-11 h-12 rounded-xl bg-muted/20 border-none font-bold" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Username</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="student_name" {...field} className="pl-11 h-12 rounded-xl bg-muted/20 border-none font-bold" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">
                      {signupType === "webmail" ? "University Webmail" : "Personal Email (Gmail)"}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder={signupType === "webmail" ? "name@students.mak.ac.ug" : "name@gmail.com"} {...field} className="pl-11 h-12 rounded-xl bg-muted/20 border-none font-bold" />
                      </div>
                    </FormControl>
                    <FormDescription className="text-[10px] ml-1">
                      {signupType === "webmail" ? "Use @students.mak.ac.ug or @mubs.ac.ug." : "Use your personal Gmail address."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="studentNumber"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between px-1">
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Student No.</FormLabel>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                                <TooltipContent><p className="text-[10px]">Must be exactly 10 digits.</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="2100123456" {...field} maxLength={10} className="pl-11 h-12 rounded-xl bg-muted/20 border-none font-bold" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="registrationNumber"
                  render={({ field }) => (
                    <FormItem>
                       <div className="flex items-center justify-between px-1">
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Reg No.</FormLabel>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                                <TooltipContent><p className="text-[10px]">Format like: 25/U/01669/PS</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="25/U/01669/PS" {...field} className="pl-11 h-12 rounded-xl bg-muted/20 border-none font-bold uppercase" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                           <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input type={showPassword ? "text" : "password"} placeholder="Min 8 chars" {...field} className="pl-11 pr-10 h-12 rounded-xl bg-muted/20 border-none font-bold" />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Confirm</FormLabel>
                      <FormControl>
                        <div className="relative">
                           <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input type={showPassword ? "text" : "password"} placeholder="Min 8 chars" {...field} className="pl-11 h-12 rounded-xl bg-muted/20 border-none font-bold" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 transition-all active:scale-[0.98] mt-4" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
                {isSubmitting ? "Enrolling..." : "Create Account"}
              </Button>
            </form>
          </Form>
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-6 pb-12 pt-4">
        <p className="text-sm font-bold text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign In
          </Link>
        </p>
        <Link href="/" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
            &larr; Back to Landing Page
        </Link>
      </CardFooter>
    </Card>
  );
}
