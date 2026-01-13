// app/api/livekit/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { WebhookEvent } from "livekit-server-sdk";
import crypto from "crypto";
import prisma from "@/lib/prisma";

// Helper function to verify the LiveKit signature
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

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(auth.t)) > 5 * 60) {
    return false;
  }

  const sig = crypto
    .createHmac("sha256", apiSecret)
    .update(`${auth.t}.${auth.s}`)
    .digest("hex");

  return sig === auth.s;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Server config error" },
        { status: 500 }
      );
    }

    const body = await req.text();
    // We keep the raw body log in case we need to debug structure again
    // console.log("Webhook received", body);
    const header = req.headers.get("livekit-webhook-authorization");

    // 1. Verify the signature
    const isVerified = verifyWebhook(body, header, apiKey, apiSecret);
    if (!isVerified) {
      console.error("Invalid LiveKit Signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 2. Parse the Event
    const event = WebhookEvent.fromJson(JSON.parse(body));

    if (!event.egressInfo)
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    // 3. Check if this is an Egress Ended event (Recording finished)
    if (event.event === "egress_ended") {
      // FIX 1: Use 'egressInfo.egressId' instead of 'event.id'
      // 'event.id' is the ID of the webhook message itself.
      // 'egressInfo.egressId' matches what we stored in the database when we started recording.
      const egressId = event.egressInfo.egressId;

      console.log(`Webhook received for Egress ID: ${egressId}`);

      // FIX 2: Extract the URL correctly from your JSON structure
      // Based on your JSON: "fileResults": [{ "location": "https://..." }]
      let videoUrl = null;

      if (
        event.egressInfo.fileResults &&
        event.egressInfo.fileResults.length > 0
      ) {
        videoUrl = event.egressInfo.fileResults[0].location;
      }
      // Fallback for older versions or single file structure
      else if (event.egressInfo.fileResults) {
        videoUrl = event.egressInfo.fileResults[0].location;
      }

      if (videoUrl) {
        console.log(`Recording URL found: ${videoUrl}`);

        // 4. Update Database
        const updatedRoom = await prisma.liveRoom.updateMany({
          where: {
            egressId: egressId, // This matches the ID stored in startLiveSession
          },
          data: {
            recordingUrl: videoUrl, // FIX 3: Use the actual URL, not createdAt
            recordingStatus: "COMPLETED",
            status: "ENDED",
            endedAt: new Date(),
          },
        });

        if (updatedRoom.count > 0) {
          console.log("Database updated successfully.");
        } else {
          console.warn(
            `No room found with egressId: ${egressId}. Check if it matches startLiveSession ID.`
          );
        }
      } else {
        console.warn(
          "Egress event received but no URL found in payload.",
          JSON.stringify(event.egressInfo)
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
