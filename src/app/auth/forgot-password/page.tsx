import { redirect } from 'next/navigation'

// Passwörter wurden 2026-06-09 durch 8-stelligen E-Mail-Code ersetzt.
// Diese Route bleibt als Redirect erhalten, damit alte Lesezeichen / Links
// aus früheren Mails nicht in 404 laufen.
export default function ForgotPasswordPage() {
  redirect('/auth/login')
}
