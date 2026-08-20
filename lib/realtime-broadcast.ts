import "server-only";
import { createAdminClient } from "./supabase/server";

/**
 * Sends a one-off Realtime Broadcast message from server-side code. Uses a
 * public (non-private) channel, so no RLS grant is needed - the channel
 * topic name itself (which embeds the project id) is the access gate, the
 * same capability model as the rest of the leader-facing access design.
 */
export async function broadcastProjectTimerStarted(
  projectId: string,
  timerStartedAt: string
) {
  const supabase = createAdminClient();
  const channel = supabase.channel(`project-timer:${projectId}`);

  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel
          .send({
            type: "broadcast",
            event: "timer_started",
            payload: { timerStartedAt },
          })
          .then(() => resolve())
          .catch(reject);
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        reject(new Error(`Realtime channel error: ${status}`));
      }
    });
  });

  await supabase.removeChannel(channel);
}
