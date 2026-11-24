"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import NextImage from 'next/image';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export function Logo({ className, size = 'md', showText = true }: LogoProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-16 w-16',
    xl: 'h-24 w-24',
  };

  const textClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
    xl: 'text-6xl',
  };

  const dimensions = {
    sm: 24,
    md: 40,
    lg: 64,
    xl: 96,
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("relative shrink-0 overflow-hidden rounded-xl", sizeClasses[size])}>
        <NextImage 
          src="/icon.png" 
          alt="MakChat Logo" 
          width={dimensions[size]} 
          height={dimensions[size]} 
          className="object-cover h-full w-full"
          priority
        />
      </div>
      {showText && (
        <span className={cn(
          "font-black font-headline tracking-tighter text-[#5DADE2]",
          textClasses[size]
        )}>
          MakChat
        </span>
      )}
    </div>
  );
}
