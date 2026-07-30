// Service brand icons + small shared UI primitives for Atlas.

import { Twitter, Instagram, Facebook, Linkedin, Youtube, Twitch as TiktokAlt } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Service } from "@/lib/types";

interface ServiceMeta { Icon: LucideIcon; className: string; label: string }

const MAP: Record<string, ServiceMeta> = {
  twitter: { Icon: Twitter, className: "svc-twitter", label: "X / Twitter" },
  instagram: { Icon: Instagram, className: "svc-instagram", label: "Instagram" },
  facebook: { Icon: Facebook, className: "svc-facebook", label: "Facebook" },
  linkedin: { Icon: Linkedin, className: "svc-linkedin", label: "LinkedIn" },
  tiktok: { Icon: TiktokAlt, className: "svc-tiktok", label: "TikTok" },
  youtube: { Icon: Youtube, className: "svc-youtube", label: "YouTube" },
  threads: { Icon: Instagram, className: "svc-threads", label: "Threads" },
  pinterest: { Icon: Instagram, className: "svc-pinterest", label: "Pinterest" },
  mastodon: { Icon: Instagram, className: "svc-mastodon", label: "Mastodon" },
  bluesky: { Icon: Twitter, className: "svc-bluesky", label: "Bluesky" },
  startPage: { Icon: Linkedin, className: "svc-startPage", label: "Start Page" },
  googleBusiness: { Icon: Linkedin, className: "svc-googleBusiness", label: "Google Business" },
};

export function serviceMeta(service: Service): ServiceMeta {
  const key = String(service).toLowerCase();
  return MAP[key] ?? { Icon: Twitter, className: "text-white/50", label: String(service) };
}

export function ServiceIcon({ service, size = 16, className = "" }: { service: Service; size?: number; className?: string }) {
  const { Icon, className: cls } = serviceMeta(service);
  return <Icon size={size} className={`${cls} ${className}`} />;
}
