import { api } from "@cue/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import React from "react";

import { useSocialEventNotifications } from "@/lib/social-event-notifications";

export function LiveSocialEventHost() {
  const socialEvents = useQuery((api as any).socialEvents.recentForCurrentUser);

  useSocialEventNotifications(socialEvents?.events ?? []);

  return null;
}
