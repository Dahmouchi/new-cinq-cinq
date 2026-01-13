// app/api/livekit/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { WebhookEvent } from "livekit-server-sdk";
import crypto from "crypto";
import prisma from "@/lib/prisma";

// This handles the verification that the webhook is actually from LiveKit
function verifyWebhook(
  body: string,
  header: string | null,
  apiKey: string | undefined,
  apiSecret: string | undefined
): boolean {
  if (!header || !apiKey || !apiSecret) return false;

  const authParts = header.split(", ");
  const auth: Record<string, string> = {};

  for (const part of authParts) {
    const [key, value] = part.split("=");
    auth[key] = value.substring(1, value.length - 1);
  }

  if (auth.t === undefined || auth.s === undefined) return false;

  // Check if timestamp is recent (prevent replay attacks)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(auth.t)) > 5 * 60) {
    return false; // Request is too old
  }

  const sig = crypto
    .createHmac("sha256", apiSecret)
    .update(`${auth.t}.${auth.s}`)
    .digest("hex");

  return sig === auth.s;
}

export async function POST(req: NextRequest) {
  try {
    console.log("Webhook received");
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Server config error" },
        { status: 500 }
      );
    }

    const body = await req.text();
    const header = req.headers.get("livekit-webhook-authorization");

    // 1. Verify the signature (Security check)
    const isVerified = verifyWebhook(body, header, apiKey, apiSecret);
    if (!isVerified) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 2. Parse the Event
    const event = WebhookEvent.fromJson(JSON.parse(body));

    // 3. Check if this is an Egress Ended event (Recording finished)
    if (event.event === "egress_ended") {
      const egressEvent = event; // Type is inferred

      const egressId = egressEvent.id;

      // The structure of the event depends on the LiveKit version,
      // but typically the url is inside the result object.
      // Check the logs in step 2 if this is undefined.
      const videoUrl = egressEvent.createdAt;

      if (videoUrl) {
        console.log(`Webhook received for Egress ID: ${egressId}`);
        console.log(`Recording URL: ${videoUrl}`);

        // 4. Update Database
        // We find the room by the egressId we stored when we started recording
        const updatedRoom = await prisma.liveRoom.updateMany({
          where: {
            egressId: egressId,
          },
          data: {
            recordingUrl: videoUrl.toString() || "",
            recordingStatus: "COMPLETED",
            status: "ENDED", // Ensure status is ended
            endedAt: new Date(),
          },
        });

        if (updatedRoom.count > 0) {
          console.log("Database updated with recording URL");
        } else {
          console.warn("No room found with that egressId");
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
