import { redirect } from "next/navigation";

// Old context pages are no longer used — redirect to dashboard
export default function ContextPage() {
  redirect("/");
}
