import { buildLlmsFullTxt } from "@/lib/seo/llms";
import { getLiveNumbers } from "@/lib/seo/live-numbers";

export const revalidate = 3600;

export async function GET() {
  const live = await getLiveNumbers().catch((error: unknown) => {
    console.error("[llms-full.txt] live numbers unavailable:", error);
    return null;
  });
  return new Response(buildLlmsFullTxt(live), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
