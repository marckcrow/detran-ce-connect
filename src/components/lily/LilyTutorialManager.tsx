import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLily } from "./LilyContext";
import { TutorialOverlay } from "./TutorialOverlay";
import { getTutorialById } from "@/lib/lily-tutorials";

export function LilyTutorialManager() {
  const {
    activeTutorial,
    nextTutorialStep,
    prevTutorialStep,
    completeTutorial,
    exitTutorial,
  } = useLily();
  const navigate = useNavigate();

  // Navigate to tutorial route when starting
  useEffect(() => {
    if (activeTutorial) {
      const tutorial = getTutorialById(activeTutorial.id);
      if (tutorial?.route && window.location.pathname !== tutorial.route) {
        navigate(tutorial.route);
      }
    }
  }, [activeTutorial]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeTutorial) return null;

  const tutorial = getTutorialById(activeTutorial.id);
  if (!tutorial) return null;

  return (
    <TutorialOverlay
      tutorial={tutorial}
      currentStep={activeTutorial.step}
      onNext={nextTutorialStep}
      onPrev={prevTutorialStep}
      onComplete={() => completeTutorial(activeTutorial.id)}
      onExit={exitTutorial}
    />
  );
}
