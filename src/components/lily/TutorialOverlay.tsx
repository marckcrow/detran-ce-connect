import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export type TutorialStep = {
  target: string; // CSS selector
  title: string;
  content: string;
  action?: string; // e.g. "Agora clique em X"
  position?: "top" | "bottom" | "left" | "right";
};

export type TutorialDefinition = {
  id: string;
  steps: TutorialStep[];
};

type Props = {
  tutorial: TutorialDefinition;
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onComplete: () => void;
  onExit: () => void;
};

const POSITION_MAP: Record<string, string> = {
  top: "bottom-full mb-3 left-1/2 -translate-x-1/2",
  bottom: "top-full mt-3 left-1/2 -translate-x-1/2",
  left: "right-full mr-3 top-1/2 -translate-y-1/2",
  right: "left-full ml-3 top-1/2 -translate-y-1/2",
};

export function TutorialOverlay({
  tutorial,
  currentStep,
  onNext,
  onPrev,
  onComplete,
  onExit,
}: Props) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetEl, setTargetEl] = useState<Element | null>(null);
  const step = tutorial.steps[currentStep];
  const totalSteps = tutorial.steps.length;
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;
  const position = step.position ?? "bottom";
  const tooltipPosClass = POSITION_MAP[position] ?? POSITION_MAP.bottom;

  // Find target element
  useEffect(() => {
    if (!step) return;
    const el = document.querySelector(step.target);
    setTargetEl(el ?? null);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [step, currentStep]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
      if (e.key === "ArrowRight" || e.key === "Enter") onNext();
      if (e.key === "ArrowLeft") onPrev();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onNext, onPrev, onExit]);

  // Scroll target into view
  useEffect(() => {
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [targetEl]);

  // Don't render if no step
  if (!step) return null;

  const tooltipStyle: React.CSSProperties = targetRect
    ? (() => {
        const GAP = 12;
        switch (position) {
          case "bottom":
            return {
              top: targetRect.bottom + GAP + window.scrollY,
              left: targetRect.left + targetRect.width / 2 + window.scrollX,
              transform: "translateX(-50%)",
            };
          case "top":
            return {
              top: targetRect.top - GAP + window.scrollY,
              left: targetRect.left + targetRect.width / 2 + window.scrollX,
              transform: "translateX(-50%)",
            };
          case "left":
            return {
              top: targetRect.top + targetRect.height / 2 + window.scrollY,
              left: targetRect.left - GAP + window.scrollX,
              transform: "translateY(-50%)",
            };
          case "right":
            return {
              top: targetRect.top + targetRect.height / 2 + window.scrollY,
              left: targetRect.right + GAP + window.scrollX,
              transform: "translateY(-50%)",
            };
          default:
            return {
              top: targetRect.bottom + GAP + window.scrollY,
              left: targetRect.left + targetRect.width / 2 + window.scrollX,
              transform: "translateX(-50%)",
            };
        }
      })()
    : {};

  return (
    <div
      className="fixed inset-0 z-[60] pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label={`Tutorial: ${step.title}`}
    >
      {/* Dark overlay — spotlight effect */}
      {!targetRect ? (
        <div className="fixed inset-0 bg-black/60 pointer-events-auto" />
      ) : (
        <>
          {/* Top overlay */}
          <div
            className="fixed left-0 right-0 bg-black/60 pointer-events-auto"
            style={{ top: 0, height: targetRect.top + window.scrollY }}
          />
          {/* Bottom overlay */}
          <div
            className="fixed left-0 right-0 bg-black/60 pointer-events-auto"
            style={{ bottom: 0, top: targetRect.bottom + window.scrollY }}
          />
          {/* Left overlay */}
          <div
            className="fixed bg-black/60 pointer-events-auto"
            style={{
              top: targetRect.top + window.scrollY,
              left: 0,
              width: targetRect.left + window.scrollX,
              height: targetRect.height,
            }}
          />
          {/* Right overlay */}
          <div
            className="fixed bg-black/60 pointer-events-auto"
            style={{
              top: targetRect.top + window.scrollY,
              right: 0,
              left: targetRect.right + window.scrollX,
              height: targetRect.height,
            }}
          />
        </>
      )}

      {/* Highlight border around target */}
      {targetRect && (
        <div
          className="fixed border-2 border-primary rounded-lg shadow-[0_0_0_4px_hsl(var(--primary)/0.3)] pointer-events-none"
          style={{
            top: targetRect.top + window.scrollY - 4,
            left: targetRect.left + window.scrollX - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        />
      )}

      {/* Tooltip bubble */}
      <div
        className="absolute z-[61] w-72 max-w-[calc(100vw-2rem)]"
        style={tooltipStyle}
      >
        {/* Arrow */}
        <div className="relative">
          <div
            className={`absolute w-3 h-3 rotate-45 bg-card border-border ${
              position === "bottom"
                ? "-top-1.5 left-1/2 -translate-x-1/2 border-t border-l"
                : position === "top"
                  ? "-bottom-1.5 left-1/2 -translate-x-1/2 border-b border-r"
                  : position === "left"
                    ? "-right-1.5 top-1/2 -translate-y-1/2 border-r border-b"
                    : "-left-1.5 top-1/2 -translate-y-1/2 border-l border-b"
            }`}
          />

          {/* Card content */}
          <div className="bg-card rounded-xl border shadow-elevated p-4 pointer-events-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-sm leading-tight">{step.title}</h3>
              <button
                onClick={onExit}
                className="text-muted-foreground hover:text-foreground transition-colors rounded p-0.5"
                aria-label="Sair do tutorial"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <p className="text-sm text-muted-foreground mb-3 whitespace-pre-line">
              {step.content}
            </p>

            {/* Action hint */}
            {step.action && (
              <p className="text-xs font-medium text-primary bg-primary/10 rounded px-2 py-1 mb-3">
                {step.action}
              </p>
            )}

            {/* Progress */}
            <div className="mb-3">
              <div className="flex gap-1 mb-1">
                {tutorial.steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= currentStep ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Passo {currentStep + 1} de {totalSteps}
              </p>
            </div>

            {/* Navigation buttons */}
            <div className="flex gap-2">
              {!isFirst && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPrev}
                  className="flex-1 gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </Button>
              )}
              {isFirst && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onExit}
                  className="flex-1 text-muted-foreground"
                >
                  Pular
                </Button>
              )}
              {isLast ? (
                <Button
                  size="sm"
                  onClick={onComplete}
                  className="flex-1 bg-gradient-hero"
                >
                  Concluir ✓
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={onNext}
                  className="flex-1 gap-1"
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
