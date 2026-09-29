import { Bot, webhookCallback } from "grammy";

export interface Env {
  BOT_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const bot = new Bot(env.BOT_TOKEN);

    // Command: /start
    bot.command("start", (ctx) =>
      ctx.reply(
        "🌸 Selamat datang di c0desk1 bot!\n\n" +
          "Command yang tersedia:\n" +
          "/start - Mulai bot\n" +
          "/help - Bantuan\n" +
          "/blog - Artikel blog terbaru\n\n" +
          "Channel: t.me/c0desk1\n" +
          "Discord: discord.gg/xxx"
      )
    );

    // Command: /help
    bot.command("help", (ctx) =>
      ctx.reply(
        "📖 Bantuan\n\n" +
          "/start - Mulai bot\n" +
          "/help - Bantuan\n" +
          "/blog - Artikel blog terbaru\n\n" +
          "Butuh bantuan lain? Hubungi @bimaakbar."
      )
    );

    // Command: /blog
    bot.command("blog", async (ctx) => {
      try {
        const res = await fetch("https://bimaakbar-dev.github.io/rss.xml");
        const xml = await res.text();

        const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
        const top5 = items.slice(0, 5);

        let message = "📝 <b>Artikel Blog Terbaru</b>\n\n";

        for (const item of top5) {
          const title = item.match(/<title>(.*?)<\/title>/)?.[1] ?? "Tanpa judul";
          const link = item.match(/<link>(.*?)<\/link>/)?.[1] ?? "";

          message += `• <a href="${link}">${title}</a>\n\n`;
        }

        message += "🔗 <a href=\"https://bimaakbar-dev.github.io\">Lihat semua</a>";

        await ctx.reply(message, { parse_mode: "HTML" });
      } catch (err) {
        await ctx.reply("❌ Gagal ambil artikel. Coba lagi nanti.");
      }
    });

    // Handle semua update
    const handler = webhookCallback(bot, "cloudflare-mod");
    return handler(request);
  },
};