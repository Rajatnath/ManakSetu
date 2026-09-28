import Header from '@/components/layout/Header';
import FileUploader from '@/components/upload/FileUploader';
import LandingInfo from '@/components/upload/LandingInfo';

export default function Home() {
  return (
    <main className="min-h-screen bg-background-primary flex flex-col">
      <Header />

      {/* Main Content */}
      <div className="flex-grow flex flex-col items-center justify-center p-4 md:p-8">
        <LandingInfo />
        <FileUploader />
      </div>
      
      {/* Footer */}
      <footer className="p-4 text-center text-text-secondary text-sm border-t border-border-primary bg-surface mt-auto">
        ManakSetu • Indian Standards Intelligence for Procurement
      </footer>
    </main>
  );
}
