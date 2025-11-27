import React, { createContext, useContext, useState, ReactNode } from "react";

interface PreviewModeContextType {
  isPreviewMode: boolean;
  togglePreviewMode: () => void;
  previewAsRole: "student" | "coach";
  setPreviewAsRole: (role: "student" | "coach") => void;
}

const PreviewModeContext = createContext<PreviewModeContextType | undefined>(undefined);

export function usePreviewMode() {
  const context = useContext(PreviewModeContext);
  if (!context) {
    throw new Error("usePreviewMode must be used within PreviewModeProvider");
  }
  return context;
}

interface PreviewModeProviderProps {
  children: ReactNode;
}

export function PreviewModeProvider({ children }: PreviewModeProviderProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewAsRole, setPreviewAsRole] = useState<"student" | "coach">("student");

  const togglePreviewMode = () => {
    setIsPreviewMode(!isPreviewMode);
  };

  return (
    <PreviewModeContext.Provider
      value={{
        isPreviewMode,
        togglePreviewMode,
        previewAsRole,
        setPreviewAsRole,
      }}
    >
      {children}
    </PreviewModeContext.Provider>
  );
}
