import React from 'react';
import { Footer } from './Footer';
import { Navbar } from './Navbar';
import { WhatsAppButton } from './WhatsAppButton';

interface PublicLayoutProps {
  isHome?: boolean;
  children: React.ReactNode;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ isHome = false, children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#042A53] relative">
      <Navbar isHome={isHome} />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};
