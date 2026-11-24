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
import { Mail, Lock, LogIn, Loader2, Eye, EyeOff, GraduationCap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { usePwaInstall } from "@/hooks/use-pwa-install";

const formSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Please enter a valid email." })
    .refine(
      (email) => email.toLowerCase().endsWith("@students.mak.ac.ug") || email.toLowerCase().endsWith("@mubs.ac.ug"),
      "Please use your official university webmail for this login."
    ),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters." }),
});

export function AuthForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { triggerInstallPrompt } = usePwaInstall();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const sanitizedEmail = values.email.trim();
      await signInWithEmailAndPassword(
        auth,
        sanitizedEmail,
        values.password
      );
      toast({
        title: "Login Successful",
        description: "Welcome back! Redirecting to your feed...",
      });
      triggerInstallPrompt(); 
      router.push("/home");
    } catch (error: any) {
      console.error("Login Error:", error);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "The webmail or password you entered is incorrect.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
      <CardHeader className="text-center bg-muted/30 pt-10 pb-8">
        <div className="flex justify-center mb-4">
            <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <GraduationCap className="h-7 w-7" />
            </div>
        </div>
        <CardTitle className="text-3xl font-black font-headline tracking-tighter">Student Webmail</CardTitle>
        <CardDescription className="font-medium">
          Sign in to your official <span className="text-primary font-bold">Mak/MUBS</span> account
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Official Webmail</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="name@students.mak.ac.ug" {...field} className="pl-11 h-12 rounded-xl bg-muted/20 border-none font-bold" />
                    </div>
                  </FormControl>
                  <FormDescription className="text-[10px] ml-1">
                    Use your official @students.mak.ac.ug or @mubs.ac.ug email.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                       <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type={showPassword ? "text" : "password"} placeholder="Minimum 8 characters" {...field} className="pl-11 pr-10 h-12 rounded-xl bg-muted/20 border-none font-bold" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 transition-all active:scale-[0.98] mt-2" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-5 w-5" />
              )}
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex-col gap-6 pb-12 pt-4">
        <p className="text-sm font-bold text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Sign Up
          </Link>
        </p>
        <Link href="/" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
            &larr; Back to Landing Page
        </Link>
      </CardFooter>
    </Card>
  );
}
