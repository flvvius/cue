import { SignInButton, UserButton, useAuth, useUser } from "@clerk/tanstack-react-start";
import { api } from "@cue/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { isLoaded, isSignedIn } = useAuth();
  const privateData = useQuery(api.privateData.get);
  const user = useUser();

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  if (!isSignedIn) {
    return <SignInButton />;
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome {user.user?.fullName}</p>
      <p>privateData: {privateData?.message ?? "Loading private data..."}</p>
      <UserButton />
    </div>
  );
}
