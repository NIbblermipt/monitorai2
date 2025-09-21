import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export async function GET() {
  const directusUrl = process.env.DIRECTUS_URL;
  const fileId = process.env.FILE_ID;

  if (!directusUrl || !fileId) redirect("/");

  // Construct the destination URL using environment variables
  const destinationUrl = `${directusUrl}/assets/${fileId}/privacy.pdf`;

  // Redirect to the constructed URL
  // NextResponse.redirect sends a 307 Temporary Redirect by default
  return NextResponse.redirect(destinationUrl);
}
