import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  sendPushNotificationToUser,
  createCommentNotification,
  createCommentReplyNotification,
} from "@/lib/push/send-notification";

// =====================================================
// Types
// =====================================================

interface CommentAuthor {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  current_level: number;
}

interface CommentResponse {
  id: string;
  author: CommentAuthor;
  original_content?: string;
  translated_content?: string;
  is_translated?: boolean;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
  likes_count: number;
  is_liked: boolean;
  replies?: CommentResponse[];
}

// =====================================================
// Validation Schemas
// =====================================================

const CreateCommentSchema = z.object({
  post_id: z.string().uuid(),
  content: z
    .string()
    .min(1, "Content is required")
    .max(1000, "Content must be 1000 characters or less"),
  parent_comment_id: z.string().uuid().optional(),
});

// =====================================================
// GET /api/community/comments - 댓글 목록 조회
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const { userId: clerkId } = await auth();

    const postId = searchParams.get("post_id");
    if (!postId) {
      return NextResponse.json({ error: "post_id is required" }, { status: 400 });
    }

    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get current user's database ID and language preference if authenticated
    let currentUserDbId: string | null = null;
    // Language param takes precedence, then country_code mapping
    let targetLanguage: string | null = searchParams.get("lang");

    if (clerkId) {
      const { data: dbUser } = await supabase
        .from("users")
        .select("id, country_code")
        .eq("clerk_id", clerkId)
        .single();
      currentUserDbId = dbUser?.id || null;
      // Map country code to language (same as posts API) - only if no lang param
      if (!targetLanguage && dbUser?.country_code) {
        const countryToLang: Record<string, string> = {
          KR: "ko",
          JP: "ja",
          CN: "zh",
          TW: "zh",
          DE: "de",
          FR: "fr",
          ES: "es",
          IT: "it",
          PT: "pt",
          BR: "pt",
          RU: "ru",
          NL: "nl",
          PL: "pl",
          TR: "tr",
          AR: "ar",
          TH: "th",
          VN: "vi",
          ID: "id",
          MY: "ms",
          PH: "tl",
          IN: "hi",
          SA: "ar",
          AE: "ar",
        };
        targetLanguage = countryToLang[dbUser.country_code] || null;
      }
    }

    // Get top-level comments (no parent)
    const {
      data: comments,
      error,
      count,
    } = await supabase
      .from("comments")
      .select(
        `
        id,
        content,
        parent_comment_id,
        likes_count,
        created_at,
        author:users!author_id (
          id,
          username,
          display_name,
          display_avatar_url,
          current_level
        )
      `,
        { count: "exact" }
      )
      .eq("post_id", postId)
      .is("deleted_at", null)
      .is("parent_comment_id", null)
      .order("created_at", { ascending: false }) // 최신순: 새 댓글이 위에
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching comments:", error);
      return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
    }

    // Get all replies and liked IDs in parallel
    const commentIds = comments?.map((c: { id: string }) => c.id) || [];
    const repliesMap: Record<string, CommentResponse[]> = {};
    let likedCommentIds: string[] = [];

    if (commentIds.length > 0) {
      // Run replies query and comment likes query in parallel
      const [repliesResult, commentLikesResult] = await Promise.all([
        // Get replies
        supabase
          .from("comments")
          .select(
            `
            id,
            content,
            parent_comment_id,
            likes_count,
            created_at,
            author:users!author_id (
              id,
              username,
              display_name,
              display_avatar_url,
              current_level
            )
          `
          )
          .eq("post_id", postId)
          .is("deleted_at", null)
          .in("parent_comment_id", commentIds)
          .order("created_at", { ascending: true }),
        // Get liked comment IDs for current user
        currentUserDbId
          ? supabase
              .from("comment_likes")
              .select("comment_id")
              .eq("user_id", currentUserDbId)
              .in("comment_id", commentIds)
          : Promise.resolve({ data: null }),
      ]);

      const replies = repliesResult.data;
      likedCommentIds =
        commentLikesResult.data?.map((l: { comment_id: string }) => l.comment_id) || [];

      // Get liked reply IDs (only if there are replies and user is logged in)
      let likedReplyIds: string[] = [];
      if (currentUserDbId && replies && replies.length > 0) {
        const replyIds = replies.map((r: { id: string }) => r.id);
        const { data: likes } = await supabase
          .from("comment_likes")
          .select("comment_id")
          .eq("user_id", currentUserDbId)
          .in("comment_id", replyIds);
        likedReplyIds = likes?.map((l: { comment_id: string }) => l.comment_id) || [];
      }

      // Group replies by parent
      replies?.forEach(
        (reply: {
          id: string;
          content: string;
          parent_comment_id: string;
          likes_count: number;
          created_at: string;
          author: {
            id: string;
            username: string;
            display_name: string | null;
            display_avatar_url: string | null;
            current_level: number;
          };
        }) => {
          const parentId = reply.parent_comment_id!;
          if (!repliesMap[parentId]) {
            repliesMap[parentId] = [];
          }
          repliesMap[parentId].push({
            id: reply.id,
            author: {
              id: reply.author.id,
              username: reply.author.username,
              display_name: reply.author.display_name,
              avatar_url: reply.author.display_avatar_url,
              current_level: reply.author.current_level,
            },
            content: reply.content,
            parent_comment_id: reply.parent_comment_id,
            created_at: reply.created_at,
            likes_count: reply.likes_count,
            is_liked: likedReplyIds.includes(reply.id),
          });
        }
      );
    }

    // Fetch cached translations if user has a target language
    const translationsMap = new Map<string, string>();
    if (targetLanguage && targetLanguage !== "en") {
      // Collect all comment IDs (top-level + replies)
      const allCommentIds = [
        ...(comments?.map((c: { id: string }) => c.id) || []),
        ...Object.values(repliesMap)
          .flat()
          .map((r) => r.id),
      ];

      if (allCommentIds.length > 0) {
        const { data: translations } = await supabase
          .from("translations")
          .select("content_id, translated_text")
          .eq("content_type", "comment")
          .eq("target_language", targetLanguage)
          .in("content_id", allCommentIds);

        translations?.forEach((t: { content_id: string; translated_text: string }) => {
          translationsMap.set(t.content_id, t.translated_text);
        });
      }
    }

    // Helper to apply translation to a comment
    const applyTranslation = (id: string, originalContent: string) => {
      const translated = translationsMap.get(id);
      const isTranslated = !!translated && translated !== originalContent;
      return {
        content: translated || originalContent,
        original_content: isTranslated ? originalContent : undefined,
        translated_content: isTranslated ? translated : undefined,
        is_translated: isTranslated,
      };
    };

    // Apply translations to replies
    Object.keys(repliesMap).forEach((parentId) => {
      const replies = repliesMap[parentId];
      if (replies) {
        repliesMap[parentId] = replies.map((reply) => ({
          ...reply,
          ...applyTranslation(reply.id, reply.content),
        }));
      }
    });

    // Transform response with translations
    const transformedComments: CommentResponse[] =
      comments?.map(
        (comment: {
          id: string;
          content: string;
          parent_comment_id: string | null;
          likes_count: number;
          created_at: string;
          author: {
            id: string;
            username: string;
            display_name: string | null;
            display_avatar_url: string | null;
            current_level: number;
          };
        }) => {
          const translationInfo = applyTranslation(comment.id, comment.content);
          return {
            id: comment.id,
            author: {
              id: comment.author.id,
              username: comment.author.username,
              display_name: comment.author.display_name,
              avatar_url: comment.author.display_avatar_url,
              current_level: comment.author.current_level,
            },
            ...translationInfo,
            parent_comment_id: comment.parent_comment_id,
            created_at: comment.created_at,
            likes_count: comment.likes_count,
            is_liked: likedCommentIds.includes(comment.id),
            replies: repliesMap[comment.id] || [],
          };
        }
      ) || [];

    return NextResponse.json({
      comments: transformedComments,
      total: count || 0,
      hasMore: offset + limit < (count || 0),
    });
  } catch (error) {
    console.error("Error in GET /api/community/comments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// POST /api/community/comments - 댓글 작성
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Get user from database
    const { data: user } = await supabase
      .from("users")
      .select("id, username, display_name, display_avatar_url, current_level")
      .eq("clerk_id", clerkId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has submission history (required to comment)
    const { count: submissionCount } = await supabase
      .from("usage_stats")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (!submissionCount || submissionCount === 0) {
      return NextResponse.json(
        {
          error: "Submission required",
          message: "You need to submit data at least once before commenting.",
        },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = CreateCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Check if post exists
    const { data: post } = await supabase
      .from("posts")
      .select("id, author_id")
      .eq("id", parsed.data.post_id)
      .is("deleted_at", null)
      .single();

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // If replying to a comment, verify parent exists and check depth limit
    let parentCommentAuthorId: string | null = null;
    if (parsed.data.parent_comment_id) {
      const { data: parentComment } = await supabase
        .from("comments")
        .select("id, author_id, parent_comment_id")
        .eq("id", parsed.data.parent_comment_id)
        .eq("post_id", parsed.data.post_id)
        .is("deleted_at", null)
        .single();

      if (!parentComment) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      }

      // Depth limit: Only allow replies to top-level comments (max 2 levels)
      if (parentComment.parent_comment_id !== null) {
        return NextResponse.json(
          { error: "Cannot reply to a reply. Maximum comment depth is 2." },
          { status: 400 }
        );
      }

      parentCommentAuthorId = parentComment.author_id;
    }

    // Insert comment
    const { data: comment, error: insertError } = await supabase
      .from("comments")
      .insert({
        post_id: parsed.data.post_id,
        author_id: user.id,
        content: parsed.data.content.trim(),
        parent_comment_id: parsed.data.parent_comment_id || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting comment:", insertError);
      return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
    }

    // Create notifications
    const notifications = [];

    // Notify post author (if not self-comment)
    if (post.author_id !== user.id) {
      notifications.push({
        user_id: post.author_id,
        type: parsed.data.parent_comment_id ? "comment_reply" : "post_comment",
        actor_id: user.id,
        post_id: parsed.data.post_id,
        comment_id: comment.id,
      });
    }

    // Notify parent comment author (if reply and not self-reply)
    if (
      parentCommentAuthorId &&
      parentCommentAuthorId !== user.id &&
      parentCommentAuthorId !== post.author_id
    ) {
      notifications.push({
        user_id: parentCommentAuthorId,
        type: "comment_reply",
        actor_id: user.id,
        post_id: parsed.data.post_id,
        comment_id: comment.id,
      });
    }

    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);

      // Send push notifications (async, don't block response)
      const actorDisplayName = user.display_name || user.username;
      notifications.forEach((notif) => {
        const payload =
          notif.type === "comment_reply"
            ? createCommentReplyNotification(
                actorDisplayName,
                parsed.data.content.trim(),
                parsed.data.post_id,
                comment.id
              )
            : createCommentNotification(
                actorDisplayName,
                parsed.data.content.trim(),
                parsed.data.post_id,
                comment.id
              );

        // Fire and forget - don't await to avoid blocking response
        sendPushNotificationToUser(notif.user_id, payload).catch((err) =>
          console.error("Failed to send push notification:", err)
        );
      });
    }

    // Return created comment with author info
    const response: CommentResponse = {
      id: comment.id,
      author: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.display_avatar_url,
        current_level: user.current_level,
      },
      content: comment.content,
      parent_comment_id: comment.parent_comment_id,
      created_at: comment.created_at,
      likes_count: 0,
      is_liked: false,
      replies: [],
    };

    return NextResponse.json({ comment: response }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/community/comments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
