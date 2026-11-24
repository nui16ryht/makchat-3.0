
import { AppLayout } from "@/components/makchat/app-layout";
import { GuestBanner } from "@/components/makchat/guest-banner";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout>
      <GuestBanner />
      {children}
    </AppLayout>
  );
}
