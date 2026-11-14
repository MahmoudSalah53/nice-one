import { ApplyThemeScript, ReapplyThemeOnMount } from "@/components/theme-toggle";
import WelcomeDynamic from "@/components/welcome-dynamic";

export default function Page() {
  return (
    <div className="bg-background">
      <ApplyThemeScript />
      <ReapplyThemeOnMount />
      <WelcomeDynamic />
    </div>
  );
}
