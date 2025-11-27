import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from "react";
import { toast } from "@/hooks/use-toast";

interface AutoSaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  saveCount: number;
}

interface AutoSaveContextType {
  autoSaveState: AutoSaveState;
  markAsDirty: () => void;
  markAsClean: () => void;
  manualSave: () => Promise<void>;
  resetAutoSave: () => void;
}

const AutoSaveContext = createContext<AutoSaveContextType | undefined>(undefined);

export function useAutoSave() {
  const context = useContext(AutoSaveContext);
  if (!context) {
    throw new Error("useAutoSave must be used within AutoSaveProvider");
  }
  return context;
}

interface AutoSaveProviderProps {
  children: ReactNode;
  onSave: () => Promise<void>;
  saveInterval?: number;
  debounceTime?: number;
  maxRetries?: number;
}

export function AutoSaveProvider({ 
  children, 
  onSave,
  saveInterval = 30000, // 30 seconds
  debounceTime = 2000, // 2 seconds
  maxRetries = 3
}: AutoSaveProviderProps) {
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>({
    isSaving: false,
    lastSaved: null,
    hasUnsavedChanges: false,
    saveCount: 0,
  });

  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const retryCountRef = useRef(0);
  const isDirtyRef = useRef(false);

  const performSave = useCallback(async (isManual = false) => {
    if (!isDirtyRef.current && !isManual) {
      return; // No changes to save
    }

    setAutoSaveState(prev => ({ ...prev, isSaving: true }));

    try {
      await onSave();
      
      // Successful save
      setAutoSaveState(prev => ({
        ...prev,
        isSaving: false,
        lastSaved: new Date(),
        hasUnsavedChanges: false,
        saveCount: prev.saveCount + 1,
      }));
      
      isDirtyRef.current = false;
      retryCountRef.current = 0;
      
      if (isManual) {
        toast({
          title: "Saved successfully",
          description: "Your changes have been saved.",
        });
      }
    } catch (error) {
      // Failed save
      console.error("Auto-save failed:", error);
      
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        
        // Retry after a delay
        setTimeout(() => {
          performSave(false);
        }, 5000 * retryCountRef.current); // Exponential backoff
        
        toast({
          title: "Save failed",
          description: `Retrying... (${retryCountRef.current}/${maxRetries})`,
          variant: "destructive",
        });
      } else {
        // Max retries reached
        setAutoSaveState(prev => ({ ...prev, isSaving: false }));
        
        toast({
          title: "Save failed",
          description: "Unable to save changes. Please try manually.",
          variant: "destructive",
        });
      }
    }
  }, [onSave, maxRetries]);

  const markAsDirty = useCallback(() => {
    if (!isDirtyRef.current) {
      isDirtyRef.current = true;
      setAutoSaveState(prev => ({ ...prev, hasUnsavedChanges: true }));
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      performSave(false);
    }, debounceTime);
  }, [debounceTime, performSave]);

  const markAsClean = useCallback(() => {
    isDirtyRef.current = false;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setAutoSaveState(prev => ({ ...prev, hasUnsavedChanges: false }));
  }, []);

  const manualSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await performSave(true);
  }, [performSave]);

  const resetAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    isDirtyRef.current = false;
    retryCountRef.current = 0;
    setAutoSaveState({
      isSaving: false,
      lastSaved: null,
      hasUnsavedChanges: false,
      saveCount: 0,
    });
  }, []);

  // Periodic save check
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (isDirtyRef.current && !autoSaveState.isSaving) {
        performSave(false);
      }
    }, saveInterval);

    return () => clearInterval(interval);
  }, [saveInterval, performSave, autoSaveState.isSaving]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <AutoSaveContext.Provider
      value={{
        autoSaveState,
        markAsDirty,
        markAsClean,
        manualSave,
        resetAutoSave,
      }}
    >
      {children}
    </AutoSaveContext.Provider>
  );
}
