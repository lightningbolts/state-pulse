import React from "react";

interface LoadingOverlayProps {
  text: string;
  smallText?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ text, smallText }) => (
  <p className="mt-6 text-center text-muted-foreground flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></span>
                  {text}
                </p>
);
