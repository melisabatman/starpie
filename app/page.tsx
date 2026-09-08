import type { Metadata } from 'next'
import AuthForm from '@/components/AuthForm'

export const metadata: Metadata = {
  title: 'Giriş Yap / Kayıt Ol — Starpie',
  description: 'Starpie\'ye giriş yap veya ücretsiz hesap oluştur.',
}

export default function AuthPage() {
  return (
    <main className="page-wrapper">
      <AuthForm />
    </main>
  )
}
