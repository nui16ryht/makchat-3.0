
"use client";

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, PixelCrop } from 'react-image-crop';
import { RotateCw } from 'lucide-react';

interface CropImageDialogProps {
  imageSrc: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (blob: Blob | null) => void;
  aspect?: number;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export function CropImageDialog({ imageSrc, open, onOpenChange, onSave, aspect }: CropImageDialogProps) {
  const [crop, setCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [rotation, setRotation] = useState(0);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    if (aspect) {
        setCrop(centerAspectCrop(width, height, aspect));
    } else {
        const newCrop = makeAspectCrop({ unit: 'px', width: Math.min(width, 500), height: Math.min(width, 500) * (height / width) }, 1, width, height) as PixelCrop;
        setCrop(centerCrop(newCrop, width, height));
    }
  }

  const handleSave = async () => {
    const image = imgRef.current;
    if (!image || !completedCrop || completedCrop.width === 0 || completedCrop.height === 0) {
      onSave(null);
      return;
    }

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;

    const rotRad = rotation * (Math.PI / 180);
    const { width: bBoxWidth, height: bBoxHeight } = getRotatedSize(
      cropWidth,
      cropHeight,
      rotation
    );

    canvas.width = bBoxWidth;
    canvas.height = bBoxHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No 2d context');
    }

    ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
    ctx.rotate(rotRad);
    ctx.translate(-cropWidth/2, -cropHeight/2);
    
    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    canvas.toBlob((blob) => {
        onSave(blob);
    }, 'image/jpeg', 0.95);
  };
  
  const getRotatedSize = (width: number, height: number, rotation: number) => {
    const rotRad = rotation * (Math.PI / 180);
    const absCos = Math.abs(Math.cos(rotRad));
    const absSin = Math.abs(Math.sin(rotRad));
    return {
      width: width * absCos + height * absSin,
      height: width * absSin + height * absCos,
    };
  };
  
  const handleRotate = () => {
    setRotation((prevRotation) => (prevRotation + 90) % 360);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crop your image</DialogTitle>
          <DialogDescription>Adjust the image below to select the part you want to display.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center my-4 max-h-[60vh] overflow-auto">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspect}
              circularCrop={aspect === 1}
            >
              <img
                ref={imgRef}
                alt="Crop me"
                src={imageSrc}
                onLoad={onImageLoad}
                style={{ 
                  maxHeight: '60vh', 
                  objectFit: 'contain',
                  transform: `rotate(${rotation}deg)`,
                }}
              />
            </ReactCrop>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleRotate} className="mr-auto">
            <RotateCw className="mr-2 h-4 w-4" /> Rotate
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
