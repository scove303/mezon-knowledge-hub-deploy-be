'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import ToastContainer from '@/components/base-ui/Toast';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '100832011919-f8ite98k0fnr1k3l1b7umdaqasgt6q1g.apps.googleusercontent.com';

export default function Providers({ children }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {children}
      <ToastContainer />
    </GoogleOAuthProvider>
  );
}
