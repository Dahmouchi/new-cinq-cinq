"use server";

import { generateLiveKitToken, generateRoomName } from "@/lib/livekit";
import { revalidatePath } from "next/cache";
import { RoomServiceClient, S3Upload } from "livekit-server-sdk";
import prisma from "@/lib/prisma";
import {
  generateRoomCode,
  getLiveKitToken,
  RoomCredentials,
} from "@/lib/livekit copy";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextAuth";
import { uploadImage } from "./cours";

const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL!,
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
);

interface CreateLiveRoomInput {
  name: string;
  description?: string;
  subjectId: string;
  teacherId: string;
  startsAt?: Date;
  duration?: number;
  maxParticipants?: number;
  recordingEnabled?: boolean;
  chatEnabled?: boolean;
  image?: File | null;
}

export async function createLiveRoom(data: CreateLiveRoomInput) {
  try {
    const [teacher, subject] = await Promise.all([
      prisma.user.findUnique({
        where: { id: data.teacherId },
        select: { id: true, name: true, prenom: true, role: true },
      }),
      prisma.subject.findUnique({
        where: { id: data.subjectId },
        select: { id: true, name: true, gradeId: true },
      }),
    ]);

    if (!teacher || teacher.role !== "TEACHER") {
      return { success: false, error: "Enseignant non trouvé" };
    }

    if (!subject) {
      return { success: false, error: "Matière non trouvée" };
    }

    const teacherFullName = `${teacher.prenom || ""} ${
      teacher.name || ""
    }`.trim();
    const livekitRoom = generateRoomName(subject.name, teacherFullName);

    let coverImageUrl: string | null = null;
    if (data.image) {
      coverImageUrl = await uploadImage(data.image);
    }
    // Créer le live room dans la base de données
    const liveRoom = await prisma.liveRoom.create({
      data: {
        name: data.name,
        description: data.description,
        type: "LIVEKIT",
        status: data.startsAt ? "SCHEDULED" : "DRAFT",
        teacherId: data.teacherId,
        subjectId: data.subjectId,
        gradeId: subject.gradeId,
        livekitRoom,
        startsAt: data.startsAt,
        image: coverImageUrl,
        duration: data.duration,
        maxParticipants: data.maxParticipants || 100,
        recordingEnabled: data.recordingEnabled ?? true,
        chatEnabled: data.chatEnabled ?? true,
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            prenom: true,
            email: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    revalidatePath("/dashboard/teacher/lives");

    return { success: true, liveRoom };
  } catch (error) {
    console.error("Error creating live room:", error);
    return {
      success: false,
      error: "Erreur lors de la création du live",
    };
  }
}

export async function startLiveRoom(liveRoomId: string, teacherId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, error: "Utilisateur non trouvé" };
    }
    const liveRoom = await prisma.liveRoom.findUnique({
      where: { id: liveRoomId },
      include: {
        teacher: true,
        subject: true,
      },
    });

    if (!liveRoom || liveRoom.teacherId !== teacherId) {
      return { success: false, error: "Live non trouvé" };
    }

    if (liveRoom.status === "LIVE") {
      return { success: false, error: "Le live est déjà en cours" };
    }
    const credentials = await getLiveKitToken(
      liveRoom.name.trim(),
      session.user.username || "",
      session.user.role === "TEACHER" ? true : false
    );
    await prisma.liveCredentials.create({
      data: {
        liveRoomId: liveRoomId,
        token: credentials.token,
        url: credentials.url,
        roomName: credentials.roomName,
      },
    });

    // Créer la room dans LiveKit
    await roomService.createRoom({
      name: liveRoom.livekitRoom!,
      emptyTimeout: 300, // 5 minutes
      maxParticipants: liveRoom.maxParticipants || 100,
    });

    // Mettre à jour le statut
    const updatedRoom = await prisma.liveRoom.update({
      where: { id: liveRoomId },
      data: {
        status: "LIVE",
        startsAt: new Date(),
      },
    });

    revalidatePath("/dashboard/teacher/lives");

    return { success: true, liveRoom: updatedRoom };
  } catch (error) {
    console.error("Error starting live room:", error);
    return {
      success: false,
      error: "Erreur lors du démarrage du live",
    };
  }
}

export async function endLiveRoomm(liveRoomId: string, teacherId: string) {
  try {
    const liveRoom = await prisma.liveRoom.findUnique({
      where: { id: liveRoomId },
    });

    if (!liveRoom || liveRoom.teacherId !== teacherId) {
      return { success: false, error: "Live non trouvé" };
    }

    // Supprimer la room de LiveKit
    try {
      await roomService.deleteRoom(liveRoom.livekitRoom!);
    } catch (error) {
      console.log("Room already deleted or doesn't exist");
    }

    // Mettre à jour le statut
    await prisma.liveRoom.update({
      where: { id: liveRoomId },
      data: {
        status: "ENDED",
        endedAt: new Date(),
      },
    });

    revalidatePath("/dashboard/teacher/lives");

    return { success: true };
  } catch (error) {
    console.error("Error ending live room:", error);
    return {
      success: false,
      error: "Erreur lors de la fin du live",
    };
  }
}
export async function endLiveRoom(liveRoomId: string, teacherId: string) {
  try {
    const liveRoom = await prisma.liveRoom.findUnique({
      where: { id: liveRoomId },
    });

    if (!liveRoom || liveRoom.teacherId !== teacherId) {
      return { success: false, error: "Unauthorized" };
    }

    // Optional: Delete the room on LiveKit server to save resources
    // Note: This also triggers the recording to stop cleanly
    if (process.env.LIVEKIT_URL) {
      const { RoomServiceClient } = await import("livekit-server-sdk");
      const roomService = new RoomServiceClient(
        process.env.LIVEKIT_URL,
        process.env.LIVEKIT_API_KEY!,
        process.env.LIVEKIT_API_SECRET!
      );

      await roomService.deleteRoom(liveRoom.livekitRoom!);
    }

    // Update status in DB
    await prisma.liveRoom.update({
      where: { id: liveRoomId },
      data: {
        status: "ENDED",
        endedAt: new Date(),
        recordingStatus: "PROCESSING", // We set this to PROCESSING. Webhook will set to COMPLETED.
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error ending live room:", error);
    return { success: false, error: "Error ending session" };
  }
}
export async function getLiveTokens(liveRoomId: string, userId: string) {
  try {
    const [liveRoom, user] = await Promise.all([
      prisma.liveRoom.findUnique({
        where: { id: liveRoomId },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, prenom: true, role: true },
      }),
    ]);

    if (!liveRoom || !user) {
      return { success: false, error: "Live ou utilisateur non trouvé" };
    }

    if (liveRoom.status !== "LIVE") {
      return { success: false, error: "Le live n'est pas en cours" };
    }

    const isTeacher = user.role === "TEACHER" && liveRoom.teacherId === userId;
    const participantName = `${user.prenom || ""} ${user.name || ""}`.trim();

    const token = await generateLiveKitToken(
      liveRoom.livekitRoom!,
      participantName,
      userId,
      isTeacher
    );

    // Enregistrer la participation
    if (!isTeacher) {
      await prisma.liveRoomParticipant.upsert({
        where: {
          liveRoomId_userId: {
            liveRoomId: liveRoomId,
            userId: userId,
          },
        },
        create: {
          liveRoomId: liveRoomId,
          userId: userId,
        },
        update: {},
      });
    }

    return { success: true, token };
  } catch (error) {
    console.error("Error generating token:", error);
    return {
      success: false,
      error: "Erreur lors de la génération du token",
    };
  }
}

export async function getTeacherLiveRooms(teacherId: string) {
  try {
    const liveRooms = await prisma.liveRoom.findMany({
      where: {
        teacherId,
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        grade: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            participants: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return liveRooms;
  } catch (error) {
    console.error("Error fetching live rooms:", error);
    return [];
  }
}

export async function getAvailableLiveRooms(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { gradeId: true },
    });

    if (!user?.gradeId) {
      return [];
    }

    const liveRooms = await prisma.liveRoom.findMany({
      where: {
        status: "LIVE",
        gradeId: user.gradeId,
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            prenom: true,
            image: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        _count: {
          select: {
            participants: true,
          },
        },
      },
      orderBy: {
        startsAt: "asc",
      },
    });

    return liveRooms;
  } catch (error) {
    console.error("Error fetching available live rooms:", error);
    return [];
  }
}

// Ajouter à la fin du fichier actions/live-room.ts existant

export async function getStudentLiveRooms(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { gradeId: true },
    });

    if (!user?.gradeId) {
      return { live: [], scheduled: [], past: [] };
    }

    const now = new Date();

    const [live, scheduled, past] = await Promise.all([
      // Lives en cours
      prisma.liveRoom.findMany({
        where: {
          gradeId: user.gradeId,
        },
        include: {
          teacher: {
            select: {
              id: true,
              name: true,
              prenom: true,
              image: true,
            },
          },
          subject: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          _count: {
            select: {
              participants: true,
            },
          },
        },
        orderBy: {
          startsAt: "asc",
        },
      }),
      // Lives programmés
      prisma.liveRoom.findMany({
        where: {
          status: "SCHEDULED",
          gradeId: user.gradeId,
          startsAt: {
            gte: now,
          },
        },
        include: {
          teacher: {
            select: {
              id: true,
              name: true,
              prenom: true,
              image: true,
            },
          },
          subject: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          _count: {
            select: {
              participants: true,
            },
          },
        },
        orderBy: {
          startsAt: "asc",
        },
        take: 10,
      }),
      // Lives passés
      prisma.liveRoom.findMany({
        where: {
          status: "ENDED",
          gradeId: user.gradeId,
        },
        include: {
          teacher: {
            select: {
              id: true,
              name: true,
              prenom: true,
              image: true,
            },
          },
          subject: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          _count: {
            select: {
              participants: true,
            },
          },
        },
        orderBy: {
          endedAt: "desc",
        },
        take: 10,
      }),
    ]);

    return { live, scheduled, past };
  } catch (error) {
    console.error("Error fetching student live rooms:", error);
    return { live: [], scheduled: [], past: [] };
  }
}

export async function getCalendarLiveRooms(
  userId: string,
  month: number,
  year: number
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { gradeId: true },
    });

    if (!user?.gradeId) {
      return [];
    }

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    const liveRooms = await prisma.liveRoom.findMany({
      where: {
        gradeId: user.gradeId,
        status: {
          in: ["SCHEDULED", "LIVE"],
        },
        startsAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            prenom: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: {
        startsAt: "asc",
      },
    });

    return liveRooms;
  } catch (error) {
    console.error("Error fetching calendar live rooms:", error);
    return [];
  }
}

export async function registerForLive(liveRoomId: string, userId: string) {
  try {
    const liveRoom = await prisma.liveRoom.findUnique({
      where: { id: liveRoomId },
      include: {
        _count: {
          select: {
            participants: true,
          },
        },
      },
    });

    if (!liveRoom) {
      return { success: false, error: "Live non trouvé" };
    }

    if (liveRoom._count.participants >= (liveRoom.maxParticipants || 100)) {
      return { success: false, error: "Le live est complet" };
    }

    await prisma.liveRoomParticipant.create({
      data: {
        liveRoomId,
        userId,
      },
    });

    revalidatePath("/dashboard/student/lives");

    return { success: true };
  } catch (error) {
    console.error("Error registering for live:", error);
    return {
      success: false,
      error: "Erreur lors de l'inscription",
    };
  }
}

export async function unregisterFromLive(liveRoomId: string, userId: string) {
  try {
    await prisma.liveRoomParticipant.delete({
      where: {
        liveRoomId_userId: {
          liveRoomId,
          userId,
        },
      },
    });

    revalidatePath("/dashboard/student/lives");

    return { success: true };
  } catch (error) {
    console.error("Error unregistering from live:", error);
    return {
      success: false,
      error: "Erreur lors de la désinscription",
    };
  }
}

export async function isUserRegistered(liveRoomId: string, userId: string) {
  try {
    const participant = await prisma.liveRoomParticipant.findUnique({
      where: {
        liveRoomId_userId: {
          liveRoomId,
          userId,
        },
      },
    });

    return !!participant;
  } catch (error) {
    return false;
  }
}

import {
  EgressClient,
  EncodedFileType,
  EncodedFileOutput,
} from "livekit-server-sdk";
import { NextResponse } from "next/server";
// ... (keep your existing createLiveRoom action)

export async function startLiveSession(liveRoomId: string) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" };
  }

  // Check ownership
  const room = await prisma.liveRoom.findUnique({
    where: { id: liveRoomId },
  });

  if (!room || room.teacherId !== session.user.id) {
    return { success: false, error: "Forbidden" };
  }

  try {
    // 2. Initialize Clients
    const livekitUrl = process.env.LIVEKIT_URL!;
    const apiKey = process.env.LIVEKIT_API_KEY!;
    const apiSecret = process.env.LIVEKIT_API_SECRET!;

    const roomServiceClient = new RoomServiceClient(
      livekitUrl,
      apiKey,
      apiSecret
    ); // <--- Create this client

    // 3. CRITICAL FIX: Create the Room on the LiveKit Server first
    // We wrap this in a try/catch because if the room already exists,
    // we don't want to stop the whole process.
    try {
      await roomServiceClient.createRoom({
        name: room.livekitRoom!,
        emptyTimeout: 10 * 60, // Close room if empty for 10 minutes
        maxParticipants: room.maxParticipants || 100,
      });
      console.log(`Room ${room.livekitRoom} created/verified.`);
    } catch (err: any) {
      // If the error is "already exists", ignore it. Otherwise, throw it.
      // LiveKit often throws 400 or 500 errors here depending on version if exists.
      console.log("Room creation log (might exist already):", err.message);
      // Do not return here, proceed to recording
    }

    // 4. Define the File Output
    // Note: Ensure you have S3/GCS configured in LiveKit config for this filepath to work
    const {
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      LIVEKIT_URL,
      S3_KEY_ID,
      S3_KEY_SECRET,
      S3_BUCKET,
      S3_ENDPOINT,
      S3_REGION,
    } = process.env;

    const hostURL = new URL(LIVEKIT_URL!);
    hostURL.protocol = "https:";

    const egressClient = new EgressClient(
      hostURL.origin,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );
    const roomName = room.livekitRoom!;
    const existingEgresses = await egressClient.listEgress({ roomName });
    if (
      existingEgresses.length > 0 &&
      existingEgresses.some((e) => e.status < 2)
    ) {
      return {
        success: false,
        error: "Meeting is already being recorded",
      };
    }

    const fileOutput = new EncodedFileOutput({
      filepath: `${new Date(Date.now()).toISOString()}-${roomName}.mp4`,
      output: {
        case: "s3",
        value: new S3Upload({
          endpoint: S3_ENDPOINT,
          accessKey: S3_KEY_ID,
          secret: S3_KEY_SECRET,
          region: S3_REGION,
          bucket: S3_BUCKET,
        }),
      },
    });

    const egressInfo = await egressClient.startRoomCompositeEgress(
      roomName,
      {
        file: fileOutput,
      },
      {
        layout: "speaker",
      }
    );

    // 6. Update DB Status
    const updatedRoom = await prisma.liveRoom.update({
      where: { id: liveRoomId },
      data: {
        status: "LIVE",
        recordingStatus: "RECORDING",
        egressId: egressInfo.egressId,
      },
    });

    return { success: true, data: updatedRoom };
  } catch (error) {
    console.error("Start Live Error:", error);
    return { success: false, error: "Failed to start recording" };
  }
}
// 1. Action to Start the Live (Teacher Only)
export async function startLiveSessionm(liveRoomId: string) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" };
  }

  // Check ownership
  const room = await prisma.liveRoom.findUnique({
    where: { id: liveRoomId },
  });

  if (!room || room.teacherId !== session.user.id) {
    return { success: false, error: "Forbidden" };
  }

  // Start Recording via LiveKit Egress
  try {
    const egressClient = new EgressClient(
      process.env.LIVEKIT_URL!,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!
    );
    const fileOutput = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: `/recordings/${room.id}-${Date.now()}.mp4`,
    });

    const egressInfo = await egressClient.startRoomCompositeEgress(
      room.livekitRoom!, // The LiveKit room name
      fileOutput,
      "speaker-light" // Layout preset as a direct string parameter
    );

    // Start recording the composite (speaker view)

    // Update DB Status
    const updatedRoom = await prisma.liveRoom.update({
      where: { id: liveRoomId },
      data: {
        status: "LIVE",
        recordingStatus: "RECORDING",
        egressId: egressInfo.egressId,
      },
    });

    return { success: true, data: updatedRoom };
  } catch (error) {
    console.error("Egress Error:", error);
    return { success: false, error: "Failed to start recording" };
  }
}

// 2. Action to get the JWT Token (Client calls this to connect)
export async function getLiveToken(liveRoomId: string) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" };
  }

  // This mimics the API logic we wrote previously, but as a Server Action
  try {
    const liveRoom = await prisma.liveRoom.findUnique({
      where: { id: liveRoomId },
      include: { teacher: true },
    });

    if (!liveRoom) {
      return { success: false, error: "Room not found" };
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) return { success: false, error: "User not found" };

    // Determine Role
    const isTeacher = liveRoom.teacherId === user.id;
    const isStudent = !isTeacher;

    // Import AccessToken locally to avoid circular dependencies or top-level import issues if not careful
    const { AccessToken } = await import("livekit-server-sdk");

    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
      {
        identity: user.id,
        name: user.name || user.username || "Guest",
        ttl: 60 * 60,
      }
    );

    // Permissions
    token.addGrant({
      room: liveRoom.livekitRoom!,
      roomJoin: true,
      canPublish: isTeacher || liveRoom.chatEnabled, // Students can publish if chat/video is enabled
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isTeacher,
    });

    // Record student join (Optional)
    if (isStudent) {
      await prisma.liveRoomParticipant.upsert({
        where: {
          liveRoomId_userId: { liveRoomId: liveRoom.id, userId: user.id },
        },
        create: { liveRoomId: liveRoom.id, userId: user.id },
        update: {},
      });
    }

    const jwtToken = await token.toJwt();

    return {
      success: true,
      token: jwtToken,
      url: process.env.LIVEKIT_URL,
      roomName: liveRoom.livekitRoom,
      isTeacher,
      status: liveRoom.status,
      recordingUrl: liveRoom.recordingUrl, // Pass this if we need to show recording
    };
  } catch (error) {
    console.error("Token Error:", error);
    return { success: false, error: "Server Error" };
  }
}
