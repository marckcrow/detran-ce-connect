import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRoles } from "@/hooks/useRoles";

const STORAGE_KEY = "lily-tutorials-seen";

function loadTutorialsSeen(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveTutorialsSeen(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export type TutorialStatus = "not-seen" | "in-progress" | "completed";

export type ActiveTutorial = {
  id: string;
  step: number;
};

export type LilyUserRole =
  | "admin"
  | "operador"
  | "logistica"
  | "consulta"
  | "instituicao"
  | "any";

/**
 * Role hierarchy — used to filter help content by permission level.
 * Higher index = more access. isRoleAtLeast() checks if a user has
 * at least the minimum required role for a given feature.
 */
const ROLE_HIERARCHY: LilyUserRole[] = [
  "any",
  "instituicao",
  "consulta",
  "logistica",
  "operador",
  "admin",
];

export function isRoleAtLeast(
  userRole: LilyUserRole,
  minRole: LilyUserRole
): boolean {
  return ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(minRole);
}

type LilyContextValue = {
  isOpen: boolean;
  /** True while roles are being fetched from DB — show only public content */
  isLoadingProfile: boolean;
  currentScreen: string;
  open: (screen?: string) => void;
  close: () => void;
  toggle: () => void;
  setCurrentScreen: (screen: string) => void;
  // Tutorials
  activeTutorial: ActiveTutorial | null;
  tutorialsSeen: string[];
  startTutorial: (id: string) => void;
  completeTutorial: (id: string) => void;
  nextTutorialStep: () => void;
  prevTutorialStep: () => void;
  exitTutorial: () => void;
  tutorialStatus: (id: string) => TutorialStatus;
  resetTutorials: () => void;
  // Role
  userRole: LilyUserRole;
};

const LilyContext = createContext<LilyContextValue | null>(null);

export function LilyProvider({ children }: { children: ReactNode }) {
  const { isAdmin, isOperador, isLogistica, isStaff, isInstituicao, roles, loading: rolesLoading } =
    useRoles();
  const [isOpen, setIsOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState("/");
  const [tutorialsSeen, setTutorialsSeen] = useState<string[]>(
    loadTutorialsSeen
  );
  const [activeTutorial, setActiveTutorial] =
    useState<ActiveTutorial | null>(null);

  // Derive user role — use "any" while loading to hide restricted content
  const userRole = useMemo<LilyUserRole>(() => {
    if (rolesLoading) return "any";
    if (isAdmin) return "admin";
    if (isOperador && roles.includes("operador")) return "operador";
    if (isLogistica && roles.includes("logistica")) return "logistica";
    if (isStaff) return "consulta";
    if (isInstituicao) return "instituicao";
    return "any";
  }, [isAdmin, isOperador, isLogistica, isStaff, isInstituicao, roles, rolesLoading]);

  const open = useCallback((screen = "/") => {
    setCurrentScreen(screen);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const startTutorial = useCallback(
    (id: string) => {
      setActiveTutorial({ id, step: 0 });
      if (!tutorialsSeen.includes(id)) {
        const next = [...tutorialsSeen, id];
        setTutorialsSeen(next);
        saveTutorialsSeen(next);
      }
    },
    [tutorialsSeen]
  );

  const completeTutorial = useCallback(
    (id: string) => {
      setActiveTutorial(null);
      if (!tutorialsSeen.includes(id)) {
        const next = [...tutorialsSeen, id];
        setTutorialsSeen(next);
        saveTutorialsSeen(next);
      }
    },
    [tutorialsSeen]
  );

  const nextTutorialStep = useCallback(() => {
    setActiveTutorial((prev) =>
      prev ? { ...prev, step: prev.step + 1 } : null
    );
  }, []);

  const prevTutorialStep = useCallback(() => {
    setActiveTutorial((prev) =>
      prev ? { ...prev, step: Math.max(0, prev.step - 1) } : null
    );
  }, []);

  const exitTutorial = useCallback(() => setActiveTutorial(null), []);

  const tutorialStatus = useCallback(
    (id: string): TutorialStatus => {
      if (activeTutorial?.id === id) return "in-progress";
      if (tutorialsSeen.includes(id)) return "completed";
      return "not-seen";
    },
    [activeTutorial, tutorialsSeen]
  );

  const resetTutorials = useCallback(() => {
    setTutorialsSeen([]);
    saveTutorialsSeen([]);
    setActiveTutorial(null);
  }, []);

  return (
    <LilyContext.Provider
      value={{
        isOpen,
        isLoadingProfile: rolesLoading,
        currentScreen,
        open,
        close,
        toggle,
        setCurrentScreen,
        activeTutorial,
        tutorialsSeen,
        startTutorial,
        completeTutorial,
        nextTutorialStep,
        prevTutorialStep,
        exitTutorial,
        tutorialStatus,
        resetTutorials,
        userRole,
      }}
    >
      {children}
    </LilyContext.Provider>
  );
}

export function useLily(): LilyContextValue {
  const ctx = useContext(LilyContext);
  if (!ctx) throw new Error("useLily must be used within LilyProvider");
  return ctx;
}
