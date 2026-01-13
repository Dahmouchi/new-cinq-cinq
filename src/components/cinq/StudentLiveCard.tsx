"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Video,
  Users,
  Clock,
  CalendarDays,
  User,
  PlayCircle,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { registerForLive, unregisterFromLive } from "@/actions/live-room";
import { toast } from "react-toastify";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface StudentLiveCardProps {
  room: any;
  isRegistered?: boolean;
  userId: string;
}

export function StudentLiveCard({
  room,
  isRegistered,
  userId,
}: StudentLiveCardProps) {
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(isRegistered);
  const router = useRouter();

  const handleRegister = async () => {
    setLoading(true);
    try {
      const result = await registerForLive(room.id, userId);
      if (result.success) {
        setRegistered(true);
        toast.success("Inscription confirmée");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  const handleUnregister = async () => {
    setLoading(true);
    try {
      const result = await unregisterFromLive(room.id, userId);
      if (result.success) {
        setRegistered(false);
        toast.info("Désinscription effectuée");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Erreur lors de la désinscription");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = () => {
    router.push(`/dashboard/live/${room.id}`);
  };

  const getStatusConfig = () => {
    switch (room.status) {
      case "LIVE":
        return {
          label: "En Direct",
          color: "bg-red-500 hover:bg-red-600",
          icon: "live",
        };
      case "SCHEDULED":
        return {
          label: "Programmé",
          color: "bg-blue-500 hover:bg-blue-600",
          icon: "scheduled",
        };
      case "ENDED":
        return {
          label: "Terminé",
          color: "bg-gray-500 hover:bg-gray-600",
          icon: "ended",
        };
      default:
        return {
          label: "Brouillon",
          color: "bg-gray-400 hover:bg-gray-500",
          icon: "draft",
        };
    }
  };

  const statusConfig = getStatusConfig();
  const teacherName = `${room.teacher.prenom || ""} ${
    room.teacher.name || ""
  }`.trim();
  const initials = `${room.teacher.prenom?.[0] || ""}${
    room.teacher.name?.[0] || ""
  }`;
  const participantCount = room._count?.participants || 0;

  return (
    <Card className="rounded-3xl py-0 p-5 card-shadow hover:card-shadow-hover transition-all duration-300 animate-fade-in">
      {/* Image Cover with Overlay */}

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12 border-2 border-background">
            <AvatarImage src={room.teacher.image} />
            <AvatarFallback>{room.teacher.prenom[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h4 className="font-semibold">
              {room.teacher.prenom} {room.teacher.name}
            </h4>
            <p className="text-xs text-muted-foreground">Instructor</p>
          </div>
        </div>
        {room.status === "LIVE" && (
          <div className="flex items-center gap-1.5 bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-xs font-medium animate-pulse">
            <span className="w-2 h-2 bg-current rounded-full" />
            LIVE
          </div>
        )}
      </div>

      {/* Content Below Image */}
      <div className="grid grid-cols-5 gap-4">
        <div
          className="col-span-2 w-full h-[15vh] rounded-2xl"
          style={{
            backgroundImage: `url(${room.image})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        ></div>
        {/* Room Title */}
        <div className="col-span-3 gap-2 space-y-1">
          {room.subject?.name && (
            <div className="">
              <Badge
                variant="default"
                className="backdrop-blur-sm bg-blue-600 text-white rounded-full"
              >
                {room.subject.name}
              </Badge>
            </div>
          )}
          <h3 className="font-semibold text-lg leading-tight line-clamp-1 group-hover:text-primary transition-colors">
            {room.name}
          </h3>
          {room.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
              {room.description}
            </p>
          )}
          {room.startsAt && (
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <span className="font-medium">
                  {format(new Date(room.startsAt), "PPP", { locale: fr })}
                </span>
                <span className="text-muted-foreground ml-2">
                  à {format(new Date(room.startsAt), "HH:mm")}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
      </div>
      <div className="w-full ">
        {room.status === "LIVE" ? (
          <Button
            size="lg"
            className="w-full gap-2 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
            onClick={handleJoin}
          >
            <PlayCircle className="h-5 w-5" />
            Rejoindre le live
          </Button>
        ) : room.status === "SCHEDULED" ? (
          <div className="flex gap-2 w-full">
            {registered ? (
              <>
                <Button
                  onClick={handleUnregister}
                  disabled={loading}
                  className={cn(
                    "w-full rounded-full",
                    "bg-blue-600 text-white hover:bg-blue-600/80"
                  )}
                >
                  <Video className="w-4 h-4 mr-2" />
                  Se désinscrire
                </Button>
              </>
            ) : (
              <Button
                className={cn(
                  "w-full rounded-full bg-primary",
                  "text-secondary-foreground hover:bg-primary/80"
                )}
                onClick={handleRegister}
                disabled={loading}
              >
                {loading ? "..." : "S'inscrire"}
              </Button>
            )}
          </div>
        ) : room.status === "ENDED" ? (
          <div className="flex gap-2">
            {room.recordingStatus === "RECORDING" ? (
              <div className="w-full flex items-center">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={() =>
                    router.push(`/dashboard/live/${room.id}/replay`)
                  }
                >
                  Voir le replay
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push(`/dashboard/live/${room.id}`)}
                  title="Voir détails"
                >
                  <Video className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                disabled
                className="flex-1 rounded-full"
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                in progress
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
