import { NextResponse } from "next/server";
import { getEnvironmentStatus, getReadinessSummary } from "@/lib/env-validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const summary = getReadinessSummary();
  const services = getEnvironmentStatus().map(({ key, label, group, required, configured }) => ({
    key,
    label,
    group,
    required,
    configured,
  }));

  return NextResponse.json(
    {
      application: "GY-NEXUS AI COMPANY OS",
      version: "2.0.0",
      status: summary.ready ? "operational" : "configuration_required",
      timestamp: new Date().toISOString(),
      summary,
      services,
    },
    { status: summary.ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
