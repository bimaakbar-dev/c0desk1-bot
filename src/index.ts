import { Bot, webhookCallback } from "grammy";

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

    // Command: /start
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

    // Command: /help
    bot.command("help", (ctx) =>
      ctx.reply(
        "Bantuan\n\n" +
          "/start - Mulai bot\n" +
          "/help - Bantuan\n" +
          "/blog - Artikel blog terbaru\n\n" +
          "Butuh bantuan lain? Hubungi @Bimaakbar."
      )
    );

    // Command: /blog
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

    // Auto-welcome untuk member baru di grup
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

    // Handler webhook
    const handler = webhookCallback(bot, "cloudflare-mod");
    return handler(request);
  },
};