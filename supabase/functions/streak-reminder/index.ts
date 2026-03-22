import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function: streak-reminder
 * Runs daily via cron. Finds users whose streak is about to break
 * (last activity was yesterday) and sends them a push notification.
 *
 * Schedule: Every day at 18:00 UTC (20:00 CET)
 * Cron: 0 18 * * *
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.serve(async (req: Request) => {
  const corsHeaders = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find users with active streaks (>= 2) who haven't been active today
    // Their last login was yesterday → streak breaks if they don't play today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Get users with streaks >= 2 whose last login was yesterday (not today)
    const { data: atRiskUsers, error } = await supabase
      .from("user_daily_login")
      .select("user_id, current_streak, last_login_date")
      .gte("current_streak", 2)
      .eq("last_login_date", yesterdayStr);

    if (error) {
      console.error("Query error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }

    if (!atRiskUsers || atRiskUsers.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No at-risk streaks" }), { headers: corsHeaders });
    }

    let sent = 0;
    let failed = 0;

    for (const user of atRiskUsers) {
      try {
        // Send push via our existing send-push function
        const { error: pushError } = await supabase.functions.invoke("send-push", {
          body: {
            user_id: user.user_id,
            title: `🔥 Dein ${user.current_streak}-Tage Streak endet heute!`,
            body: "Öffne DealBuddy und halte deinen Streak am Leben. Ein Deal reicht!",
            url: "/app/home",
            tag: "streak-reminder",
          },
        });

        if (pushError) {
          console.error(`Push failed for ${user.user_id}:`, pushError);
          failed++;
        } else {
          // Also insert an in-app notification
          await supabase.from("notifications").insert({
            user_id: user.user_id,
            type: "streak_warning",
            title: `🔥 ${user.current_streak}-Tage Streak in Gefahr!`,
            body: "Öffne die App und schließe einen Deal ab, um deinen Streak zu behalten.",
            action_url: "/app/home",
          });
          sent++;
        }
      } catch (err) {
        console.error("Streak reminder error:", err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ sent, failed, total: atRiskUsers.length }),
      { headers: corsHeaders }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("streak-reminder error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
