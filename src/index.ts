import { Bot, webhookCallback } from "grammy";

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  GH_WEBHOOK_SECRET: string;
  ADMIN_CHAT_ID: string;
  DISCORD_WEBHOOK_GISCUS: string;
}

// Verifikasi signature GitHub
async function verifySignature(
  secret: string,
  body: string,
  signature: string | null
): Promise<boolean> {
  if (!signature) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hashArray = Array.from(new Uint8Array(sig));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return signature === `sha256=${hashHex}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route /github → webhook Giscus
    if (url.pathname === "/github") {
      return handleGithub(request, env);
    }

    // Default → bot Telegram
    const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

    bot.command("start", (ctx) =>
      ctx.reply(
        "Selamat datang di c0desk1[bot]!\n\n" +
          "Command yang tersedia:\n" +
          "/start - Mulai bot\n" +
          "/help - Bantuan\n" +
          "/blog - Artikel blog terbaru\n\n" +
          "Channel: t.me/c0desk1\n" +
          "Discord: discord.gg/zzaUTzWbm"
      )
    );

    bot.command("help", (ctx) =>
      ctx.reply(
        "Bantuan\n\n" +
          "/start - Mulai bot\n" +
          "/help - Bantuan\n" +
          "/blog - Artikel blog terbaru\n\n" +
          "Butuh bantuan lain? Hubungi @Bimaakbar."
      )
    );

    bot.command("blog", async (ctx) => {
      try {
        const res = await fetch("https://bimaakbar-dev.github.io/rss.xml");
        const xml = await res.text();
        const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
        const top5 = items.slice(0, 5);

        let message = "<b>Artikel Blog Terbaru</b>\n\n";
        for (const item of top5) {
          const title = item.match(/<title>(.*?)<\/title>/)?.[1] ?? "Tanpa judul";
          const link = item.match(/<link>(.*?)<\/link>/)?.[1] ?? "";
          message += `• <a href="${link}">${title}</a>\n\n`;
        }
        message +=
          '<a href="https://bimaakbar-dev.github.io/blog/">Lihat semua →</a>';

        await ctx.reply(message, { parse_mode: "HTML" });
      } catch (err) {
        await ctx.reply("Gagal ambil artikel. Coba lagi nanti.");
      }
    });

    bot
      .filter((ctx) => {
        const msg = ctx.message;
        return !!(msg && "new_chat_members" in msg && msg.new_chat_members);
      })
      .use(async (ctx) => {
        const msg = ctx.message;
        if (!msg || !("new_chat_members" in msg)) return;
        const newMembers = msg.new_chat_members || [];

        for (const member of newMembers) {
          if (member.is_bot) continue;
          const name = member.first_name || member.username || "Pengguna";
          const mention = `[${name}](tg://user?id=${member.id})`;

          await ctx.reply(
            `Selamat datang ${mention} di c0desk1!\n\n` +
              `Aturan singkat:\n` +
              `• Saling menghormati\n` +
              `• No spam, no SARA\n` +
              `• Bahasa Indonesia/English OK`,
            { parse_mode: "Markdown" }
          );
        }
      });

    const handler = webhookCallback(bot, "cloudflare-mod");
    return handler(request);
  },
};

// Handler webhook GitHub (Giscus)
async function handleGithub(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  const valid = await verifySignature(
    env.GH_WEBHOOK_SECRET,
    body,
    signature
  );
  if (!valid) return new Response("Invalid signature", { status: 401 });

  const event = request.headers.get("x-github-event");
  const payload = JSON.parse(body);

  // Event: discussion baru
  if (event === "discussion") {
    const action = payload.action;
    if (action === "created") {
      const disc = payload.discussion;
      await notifyGiscus(env, {
        title: "💬 Diskusi Baru",
        body: `**${disc.title}**\n\nOleh: @${disc.user.login}`,
        url: disc.html_url,
        color: 3447003,
      });
    }
  }

  // Event: komentar baru
  if (event === "discussion_comment") {
    const action = payload.action;
    if (action === "created") {
      const comment = payload.comment;
      const disc = payload.discussion;
      const commentBody = comment.body;

      // Skip kalau dari bot
      if (comment.user.login.endsWith("[bot]")) {
        return new Response("OK", { status: 200 });
      }

      // Cek mention
      const mentioned = /@bimaakbar(-dev)?|@admin|@c0desk1/i.test(commentBody);

      await notifyGiscus(env, {
        title: mentioned ? "📩 Mention di Giscus" : "💬 Komentar Baru",
        body: `**${disc.title}**\n\nDari: @${comment.user.login}\n\n${commentBody.slice(0, 200)}`,
        url: disc.html_url,
        color: mentioned ? 16738314 : 5763719,
      });
    }
  }

  return new Response("OK", { status: 200 });
}

// Kirim notif ke Telegram DM + Discord
async function notifyGiscus(
  env: Env,
  data: { title: string; body: string; url: string; color: number }
): Promise<void> {
  // Telegram DM
  const tgMessage = `<b>${data.title}</b>\n\n${data.body}\n\n🔗 ${data.url}`;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.ADMIN_CHAT_ID,
      text: tgMessage,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  // Discord
  await fetch(env.DISCORD_WEBHOOK_GISCUS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: data.title,
          description: data.body,
          url: data.url,
          color: data.color,
          footer: { text: "c0desk1[bot] · giscus" },
        },
      ],
    }),
  });
}