'use client';

import ToastContainer from '@/components/base-ui/Toast';

export default function Providers({ children }) {
  return (
    <>
      {children}
      <ToastContainer />
    </>
  );
}
