import { redirect } from "next/navigation";
import { ApplyThemeScript, ReapplyThemeOnMount } from "@/components/theme-toggle";
import WelcomeDynamic from "@/components/welcome-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ dev?: string; tab?: string }>;
}) {
  const params = await searchParams;
  if (!params?.dev && !params?.tab) {
    redirect("/en");
  }

  return (
    <div className="bg-background">
      <ApplyThemeScript />
      <ReapplyThemeOnMount />
      <WelcomeDynamic />
    </div>
  );
}
