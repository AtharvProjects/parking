import { redirect } from "next/navigation";

export default function HomePage() {
  // Root redirects to dashboard (admin) or gate (operator) based on auth
  // For now, redirect to login
  redirect("/login");
}
