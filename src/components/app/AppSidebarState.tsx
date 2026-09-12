import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AppSidebarState = {
  expanded: boolean;
  toggleSidebar: () => void;
};

const AppSidebarContext = createContext<AppSidebarState | null>(null);

export function AppSidebarProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const toggleSidebar = useCallback(() => {
    setExpanded((value) => !value);
  }, []);
  const value = useMemo(
    () => ({ expanded, toggleSidebar }),
    [expanded, toggleSidebar],
  );

  return (
    <AppSidebarContext.Provider value={value}>
      {children}
    </AppSidebarContext.Provider>
  );
}

export function useAppSidebar() {
  const context = useContext(AppSidebarContext);

  if (!context) {
    throw new Error("useAppSidebar must be used within AppSidebarProvider");
  }

  return context;
}
