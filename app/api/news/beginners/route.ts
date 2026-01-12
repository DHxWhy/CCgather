import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type {
  BeginnersListResponse,
  BeginnersDictionaryItem,
  BeginnerCategory,
} from "@/types/changelog";
import { BEGINNER_CATEGORY_INFO } from "@/types/changelog";

/**
 * GET /api/news/beginners
 * FOR BEGINNERS 사전 - 카테고리별 목록
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // 전체 항목 조회
    const { data: allItems, error: itemsError } = await supabase
      .from("beginners_dictionary")
      .select("*")
      .eq("verification_status", "approved")
      .order("display_order", { ascending: true });

    if (itemsError) {
      console.error("Failed to fetch beginners dictionary:", itemsError);
      return NextResponse.json({ error: "Failed to fetch beginners dictionary" }, { status: 500 });
    }

    const items = (allItems || []) as BeginnersDictionaryItem[];

    // 카테고리별 그룹화
    const categoryOrder: BeginnerCategory[] = [
      "getting_started",
      "session",
      "speed",
      "extend",
      "agents",
      "config",
    ];

    const categories = categoryOrder
      .map((category) => {
        const categoryItems = items.filter((item) => item.category === category);
        return {
          category,
          info: BEGINNER_CATEGORY_INFO[category],
          items: categoryItems,
          itemCount: categoryItems.length,
        };
      })
      .filter((cat) => cat.itemCount > 0);

    // Featured 항목
    const featured = items.filter((item) => item.is_featured);

    const response: BeginnersListResponse = {
      categories,
      featured,
      totalItems: items.length,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Beginners API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
