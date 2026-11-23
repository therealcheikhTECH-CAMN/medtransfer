import React from 'react';
import { AlertCircle } from 'lucide-react';
import { BackButton } from '../../components/BackButton';

export const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-[#F4F6F9] p-4 sm:p-6 flex flex-col">
      <div className="w-full max-w-7xl mx-auto">
        <BackButton />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 my-auto">
        <div className="p-4 mb-4 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
          <AlertCircle className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-black text-[#123B5D] tracking-tight">404 — Page Introuvable</h1>
        <p className="mt-2 text-sm text-[#64748B] max-w-md">
          La ressource demandée n'existe pas ou vous ne possédez pas les autorisations nécessaires pour y accéder.
        </p>
        <div className="mt-6">
          <BackButton label="Retourner en arrière" />
        </div>
      </div>
    </div>
  );
};
