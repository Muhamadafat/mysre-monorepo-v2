// app/reset-password/page.tsx
// Transitional alias: redirect all legacy traffic to the canonical /update-password page.
import { redirect } from 'next/navigation';

export default function ResetPasswordPage() {
  redirect('/update-password');
}
