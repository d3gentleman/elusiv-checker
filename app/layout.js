import './globals.css';

export const metadata = {
  title: 'Elusiv Wallet Checker',
  description: 'Check Solana wallets for Elusiv pool deposits and withdrawals',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
