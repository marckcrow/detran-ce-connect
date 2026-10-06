import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLily } from "./LilyContext";
import { getContextualArticles, buildLilyResponse } from "@/lib/lily-knowledge";
import { toast } from "@/hooks/use-toast";

type Props = {
  screenName?: string;
  className?: string;
};

export function ScreenHelpButton({ screenName, className = "" }: Props) {
  const { open, userRole } = useLily();

  const handleClick = () => {
    // Get current route context — use the current browser path
    const route = window.location.pathname;
    const articles = getContextualArticles(route, userRole);

    if (articles.length > 0) {
      const resp = buildLilyResponse(articles[0]);
      open(route);
      // Show a toast with the quick info
      toast({
        title: `💡 ${articles[0].title}`,
        description: articles[0].steps[0],
        duration: 5000,
      });
    } else {
      open(route);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={`gap-1.5 text-muted-foreground hover:text-foreground ${className}`}
      aria-label={screenName ? `Ajuda sobre ${screenName}` : "Como usar esta tela?"}
    >
      <HelpCircle className="h-4 w-4" />
      {screenName ? null : <span className="hidden sm:inline text-xs">Como usar esta tela?</span>}
    </Button>
  );
}
