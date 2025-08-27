// app/layout.js
import './globals.css';
import './styles/fonts.css';
import { Inter } from 'next/font/google';
import NextTopLoader from "nextjs-toploader";
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/lib/translation/languageContext'; // Add this import


const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Link Tree',
  description: 'This is a Link tree Clone Web App Developed by Fabiconcept.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <LanguageProvider> {/* Wrap everything with LanguageProvider */}
          <AuthProvider>
            <NextTopLoader color='#8129D9' />
            {children}
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}