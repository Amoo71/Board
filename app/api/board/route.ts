import { NextRequest, NextResponse } from "next/server";
import { isWriteAllowed, readBoard, resetBoard, writeBoard } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const board = await readBoard();
  return NextResponse.json(board, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
    }
  });
}

export async function PUT(req: NextRequest) {
  if (!isWriteAllowed(req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const input = await req.json().catch(() => null);
  const board = await writeBoard(input ?? {});
  return NextResponse.json({ ok: true, board });
}

export async function DELETE(req: NextRequest) {
  if (!isWriteAllowed(req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const board = await resetBoard();
  return NextResponse.json({ ok: true, board });
}
