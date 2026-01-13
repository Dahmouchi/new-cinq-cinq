import { useState } from "react";
import LiveCard from "./LiveCard";
import SearchBar from "./SearchBar";
import { UnlockedLive } from "@/actions/client";
import { toast } from "react-toastify";
import { WhatsAppButton } from "../cinq/WhatsAppButton";
import { UnlockCodeInput } from "../cinq/UnlockCodeInput";
import { InscriptionSteps } from "../cinq/InscriptionSteps";
import { PaymentMethods } from "../cinq/PaymentMethods";
import {
  Calendar,
  CheckCircle,
  CreditCard,
  KeyRound,
  MessageCircle,
  MessageSquare,
  Send,
  Video,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { StudentLiveCard } from "../cinq/StudentLiveCard";
import { useSession } from "next-auth/react";
const steps = [
  {
    number: 1,
    icon: CreditCard,
    title: "Effectuer le paiement",
    description:
      "Choisissez votre méthode de paiement préférée (CashPlus, Virement, Banque ou Espace).",
  },
  {
    number: 2,
    icon: Send,
    title: "Récupérer le reçu",
    description:
      "Gardez le reçu de transaction ou prenez une photo claire du ticket.",
  },
  {
    number: 3,
    icon: MessageSquare,
    title: "Envoyer via WhatsApp",
    description:
      "Envoyez la photo du reçu à notre administrateur via WhatsApp.",
  },
  {
    number: 4,
    icon: KeyRound,
    title: "Recevoir le code",
    description:
      "L&apos;administrateur vous enverra un code d&apos;accès unique.",
  },
  {
    number: 5,
    icon: CheckCircle,
    title: "Accéder aux cours",
    description: "Entrez le code reçu pour débloquer tous les cours live.",
  },
];
const LivesView = ({
  liveRooms,
  registeredLives,
  user,
  onTabChange,
  loading,
}: any) => {
  const lives = [
    {
      title: "Advanced Patient Assessment Techniques",
      instructor: "Dr. Emily Chen",
      instructorImage:
        "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&h=100&fit=crop",
      date: "Today",
      time: "14:00",
      participants: 45,
      isLive: true,
      variant: "accent" as const,
    },
    {
      title: "Clinical Decision Making Workshop",
      instructor: "Prof. James Miller",
      instructorImage:
        "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop",
      date: "Tomorrow",
      time: "10:00",
      participants: 32,
      isLive: false,
      variant: "mint" as const,
    },
    {
      title: "Emergency Response Protocols",
      instructor: "Dr. Sarah Williams",
      instructorImage:
        "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=100&h=100&fit=crop",
      date: "Wed, 26.03",
      time: "15:30",
      participants: 28,
      isLive: false,
      variant: "lavender" as const,
    },
    {
      title: "Mental Health First Aid",
      instructor: "Dr. Michael Brown",
      instructorImage:
        "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=100&h=100&fit=crop",
      date: "Thu, 27.03",
      time: "11:00",
      participants: 56,
      isLive: false,
      variant: "cream" as const,
    },
  ];
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Get all unique subjects from live rooms
  const allLiveRooms = [
    ...(liveRooms.live || []),
    ...(liveRooms.scheduled || []),
  ];
  const uniqueSubjects = Array.from(
    new Map(
      allLiveRooms
        .filter((room: any) => room.subject)
        .map((room: any) => [room.subject.id, room.subject])
    ).values()
  );

  // Filter live rooms based on active category and search query
  const filteredLiveRooms = allLiveRooms.filter((room: any) => {
    // First filter by category (subject)
    const matchesCategory =
      activeCategory === "All" ||
      (room.subject && room.subject.id === activeCategory);

    // Then filter by search query (search in name and description)
    const matchesSearch =
      searchQuery === "" ||
      room.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (room.description &&
        room.description.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  const handleUnlock = async (code: string) => {
    try {
      const result = await UnlockedLive(code);
      if (result?.success) {
        toast.success("Cours débloqués avec succès");
        window.location.reload();
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
      console.error("Error unlocking live:", error);
    }
    console.log("Unlocked with code:", code);
  };
  const handleWhatsApp = () => {
    const phoneNumber = "212600000000"; // Replace with actual number
    const message = encodeURIComponent(
      "Bonjour, je souhaite m&apos;inscrire au plan Pro. Voici mon reçu de paiement:"
    );
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank");
  };
  return (
    <div className="flex-1 lg:p-6 p-3 overflow-auto lg:pb-0 pb-16">
      <div className="max-w-5xl">
        {!user.registerCode ? (
          <div className="w-full">
            <div className="w-full space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Inscription Pro
              </h1>
              <p className="text-muted-foreground text-sm">
                Débloquez tous les cours live
              </p>
            </div>
            <div className="my-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
              <UnlockCodeInput onUnlock={handleUnlock} />
              <div className="w-full h-[30vh] ">
                <div
                  className="bg-card/10 backdrop-blur-sm h-full relative rounded-2xl p-6 border border-primary-foreground/20"
                  style={{
                    backgroundImage:
                      "url(&apos;https://images.pexels.com/photos/4144923/pexels-photo-4144923.jpeg&apos;)",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="absolute inset-0 w-full h-full rounded-2xl top-0 left-0 bg-black/50 opacity-50 pointer-events-none"></div>

                  <div className="relative z-10">
                    <h3 className="text-primary-foreground font-semibold text-lg mb-4">
                      Fonctionnalités Premium en Direct
                    </h3>
                    <ul className="space-y-3">
                      {[
                        "Connectez-vous directement avec votre instructeur",
                        "Sessions individuelles en direct",
                        "Disponible 24h/24 et 7j/7",
                      ].map((feature, index) => (
                        <li
                          key={index}
                          className="flex items-center gap-3 text-primary-foreground/90"
                        >
                          <div className="w-6 h-6 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <div className="">
              <div className="w-full  space-y-6">
                {/* Steps */}
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Comment obtenir le code ?
                  </h2>
                  <div className="grid gap-3 grid-cols-1 lg:grid-cols-3">
                    {steps.map((step) => (
                      <Card
                        key={step.number}
                        className="bg-card py-0 hover:bg-primary/20 transition-colors rounded-2xl"
                      >
                        <CardContent className="p-3 flex flex-col justify-center items-center text-center gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                            <step.icon className="w-4 h-4 text-accent-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-xs font-bold text-accent-foreground bg-accent/30 px-1.5 py-0.5 rounded">
                                {step.number}
                              </span>
                              <h3 className="text-sm font-semibold text-foreground">
                                {step.title}
                              </h3>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {step.description}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <div
                      onClick={handleWhatsApp}
                      className="rounded-2xl w-full p-4 flex-col flex cursor-pointer text-white font-semibold items-center gap-2 justify-center h-full bg-[#25D366] hover:bg-[#20BD5A]"
                    >
                      <img
                        src="/cinq/whatsapp.png"
                        alt=""
                        className="w-12 h-12"
                      />
                      Contacter via WhatsApp
                    </div>
                  </div>
                </div>

                {/* WhatsApp Button */}

                {/* Back Link */}
                <button
                  onClick={() => onTabChange("courses")}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Retour à l&apos;accueil
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="lg:text-3xl text-2xl font-bold mb-4 flex items-center gap-2">
              Lives & Classrooms 🎬
            </h1>

            <p className="text-muted-foreground mb-8">
              Rejoignez des sessions en direct et des salles de classe
              interactives avec des instructeurs experts
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Rechercher une session live..."
                />
                <nav className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-hide">
                  <button
                    key={"All"}
                    onClick={() => setActiveCategory("All")}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                      activeCategory === "All"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {"Tout"}
                  </button>
                  {uniqueSubjects.map((subject: any) => (
                    <button
                      key={subject.id}
                      onClick={() => setActiveCategory(subject.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                        activeCategory === subject.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      {subject.name}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {filteredLiveRooms.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold mb-2">
                  Aucune session trouvée
                </h3>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? `Aucune session ne correspond à "${searchQuery}"`
                    : "Aucune session disponible dans cette catégorie"}
                </p>
                {(searchQuery || activeCategory !== "All") && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setActiveCategory("All");
                    }}
                    className="mt-4 text-primary hover:underline"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            ) : (
              <div>
                {/* Live Rooms Section organized by Subject */}
                {user.registerCode && !loading && (
                  <div className="">
                    {/* Group lives by subject */}
                    {(() => {
                      // Group filtered rooms by subject
                      const roomsBySubject = filteredLiveRooms.reduce(
                        (acc: any, room: any) => {
                          const subjectId = room.subject?.id || "no-subject";
                          const subjectName =
                            room.subject?.name || "Sans matière";

                          if (!acc[subjectId]) {
                            acc[subjectId] = {
                              subject: room.subject || {
                                id: "no-subject",
                                name: "Sans matière",
                              },
                              upcomingLive: null,
                              recordedLives: [],
                            };
                          }

                          // Categorize rooms into upcoming (LIVE or SCHEDULED) and recorded (ENDED)
                          if (
                            room.status === "LIVE" ||
                            room.status === "SCHEDULED"
                          ) {
                            // For upcoming, keep only the next one (earliest startsAt)
                            if (
                              !acc[subjectId].upcomingLive ||
                              (room.startsAt &&
                                acc[subjectId].upcomingLive.startsAt &&
                                new Date(room.startsAt) <
                                  new Date(
                                    acc[subjectId].upcomingLive.startsAt
                                  ))
                            ) {
                              acc[subjectId].upcomingLive = room;
                            }
                          } else if (room.status === "ENDED") {
                            acc[subjectId].recordedLives.push(room);
                          }

                          return acc;
                        },
                        {}
                      );

                      // Sort recorded lives by endedAt descending (most recent first)
                      Object.values(roomsBySubject).forEach(
                        (subjectData: any) => {
                          subjectData.recordedLives.sort((a: any, b: any) => {
                            const dateA = a.endedAt
                              ? new Date(a.endedAt).getTime()
                              : 0;
                            const dateB = b.endedAt
                              ? new Date(b.endedAt).getTime()
                              : 0;
                            return dateB - dateA;
                          });
                        }
                      );

                      return Object.values(roomsBySubject).map(
                        (subjectData: any) => (
                          <div key={subjectData.subject.id} className="mb-8">
                            <div className="flex items-center gap-2 mb-4">
                              <div
                                className="w-1 h-6 rounded-full"
                                style={{
                                  backgroundColor:
                                    subjectData.subject.color || "#3b82f6",
                                }}
                              />
                              <h2 className="text-xl font-bold">
                                {subjectData.subject.name}
                              </h2>
                            </div>

                            {/* Upcoming/Next Live */}
                            {subjectData.upcomingLive && (
                              <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                    <Video className="w-4 h-4" />
                                    <span>Prochain Live</span>
                                  </div>
                                  {subjectData.upcomingLive.status ===
                                    "LIVE" && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-600 rounded-full">
                                      <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                                      </span>
                                      EN DIRECT
                                    </span>
                                  )}
                                </div>
                                <StudentLiveCard
                                  room={subjectData.upcomingLive}
                                  userId={user.id}
                                  isRegistered={registeredLives.has(
                                    subjectData.upcomingLive.id
                                  )}
                                />
                              </div>
                            )}

                            {/* Recorded Lives */}
                            {subjectData.recordedLives.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="text-sm font-semibold text-muted-foreground">
                                    Lives enregistrés
                                  </div>
                                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                                    {subjectData.recordedLives.length}
                                  </span>
                                </div>
                                <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-4">
                                  {subjectData.recordedLives.map(
                                    (room: any) => (
                                      <StudentLiveCard
                                        key={room.id}
                                        room={room}
                                        userId={user.id}
                                        isRegistered={registeredLives.has(
                                          room.id
                                        )}
                                      />
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Empty state for subject with no lives */}
                            {!subjectData.upcomingLive &&
                              subjectData.recordedLives.length === 0 && (
                                <div className="text-center py-8 bg-secondary/30 rounded-lg">
                                  <p className="text-sm text-muted-foreground">
                                    Aucune session disponible pour cette matière
                                  </p>
                                </div>
                              )}
                          </div>
                        )
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LivesView;
