import { NextRequest, NextResponse } from "next/server";
import { EMPTY_BOARD } from "@/lib/board";
import { isWriteAllowed, readBoard, resetBoard, writeBoard } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jsonHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*"
};

export async function GET() {
  try {
    const board = await readBoard();
    return NextResponse.json(board, { headers: jsonHeaders });
  } catch (error) {
    return NextResponse.json(
      {
        ...EMPTY_BOARD,
        updatedAt: new Date().toISOString(),
        warning: "Storage unavailable, returned fallback board. Check Redis/Upstash environment variables in Vercel."
      },
      { headers: jsonHeaders }
    );
  }
}

export async function PUT(req: NextRequest) {
  if (!isWriteAllowed(req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: jsonHeaders });
  }

  try {
    const input = await req.json().catch(() => null);
    const board = await writeBoard(input ?? {});
    return NextResponse.json({ ok: true, board }, { headers: jsonHeaders });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Could not save board. Check Redis/Upstash environment variables in Vercel." },
      { status: 500, headers: jsonHeaders }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!isWriteAllowed(req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: jsonHeaders });
  }

  try {
    const board = await resetBoard();
    return NextResponse.json({ ok: true, board }, { headers: jsonHeaders });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Could not reset board. Check Redis/Upstash environment variables in Vercel." },
      { status: 500, headers: jsonHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...jsonHeaders,
      "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
