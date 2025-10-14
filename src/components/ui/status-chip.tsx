import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, Calendar } from "lucide-react";

type Status = "PENDENTE" | "APROVADO" | "CANCELADO" | "REALIZADO";

interface StatusChipProps {
  status: Status;
}

const statusConfig = {
  PENDENTE: {
    label: "Pendente",
    variant: "warning" as const,
    icon: Clock,
  },
  APROVADO: {
    label: "Aprovado",
    variant: "success" as const,
    icon: CheckCircle2,
  },
  CANCELADO: {
    label: "Cancelado",
    variant: "destructive" as const,
    icon: XCircle,
  },
  REALIZADO: {
    label: "Realizado",
    variant: "default" as const,
    icon: Calendar,
  },
};

export const StatusChip = ({ status }: StatusChipProps) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1.5">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};
