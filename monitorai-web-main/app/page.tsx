import HomeClient from "@/components/home-client";

export default function Home() {
  const directusUrl = process.env.DIRECTUS_URL;
  return <HomeClient directusUrl={directusUrl} />;
}

export const dynamic = "force-dynamic";
