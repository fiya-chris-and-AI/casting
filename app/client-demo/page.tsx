import type { Metadata } from "next";
import { Hanken_Grotesk, IBM_Plex_Sans } from "next/font/google";
import { MeridianDemo } from "@/components/MeridianDemo";

// MERIDIAN's own type — self-hosted via next/font (both SIL OFL 1.1), scoped to this page.
const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "CASTING — Client demo · MERIDIAN GOODS (fictional retailer)",
  description:
    "What a customer sees on the product page after CASTING: the same product on eight measured people. Try-on images are real Perfect Corp Apparel VTO output.",
};

export default function ClientDemoPage() {
  return (
    <div className={`${hankenGrotesk.variable} ${ibmPlexSans.variable}`}>
      <MeridianDemo />
    </div>
  );
}
