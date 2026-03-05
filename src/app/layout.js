import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata = {
  title: 'PeopleWithProjects — Code Together. Ship Faster.',
  description: 'Upload your codebase, invite your team, and edit files in real-time. Built for hackathon sprints and collaborative coding.',
  keywords: 'collaborative coding, real-time editor, hackathon, code together, firebase',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
