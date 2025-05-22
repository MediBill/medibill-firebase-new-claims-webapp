import { Stethoscope } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto px-4 py-4 flex items-center">
        <Stethoscope className="h-8 w-8 mr-3" />
        <h1 className="text-2xl font-semibold">MediBill Insights</h1>
      </div>
    </header>
  );
}
