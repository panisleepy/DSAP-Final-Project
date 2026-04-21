import PusherClient from "pusher-js";

declare global {
  var pusherClient: PusherClient | undefined;
}

export const getPusherClient = () => {
  if (!process.env.NEXT_PUBLIC_PUSHER_KEY) {
    console.warn("⚠️ NEXT_PUBLIC_PUSHER_KEY is missing. Skipping realtime subscriptions.");
    return undefined;
  }

  if (!globalThis.pusherClient) {
    globalThis.pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "ap3",
    });
  }

  return globalThis.pusherClient;
};


