"use client";

import type * as React from 'react';
import { useState, useEffect } from 'react';
import { AuthForm } from '@/components/auth-form';
import { DoctorCaseTable } from '@/components/doctor-case-table';
import { login as apiLogin, getDoctors, getAllCasesForDoctors, updateCaseStatus as apiUpdateCaseStatus } from '@/lib/medibill-api';
import type { AuthToken, Doctor, Case, CaseStatus } from '@/types/medibill';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

export default function MediBillPage() {
  const [authToken, setAuthToken] = useState<AuthToken | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start true to show loading for initial auth check/form
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Simulate checking for an existing token (e.g., from localStorage)
    // For this app, we always start with login.
    setIsLoading(false); // Allow AuthForm to render
  }, []);

  const handleLoginSuccess = (token: AuthToken) => {
    setAuthToken(token);
    setError(null);
    fetchData(token.token);
  };

  const fetchData = async (token: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedDoctors = await getDoctors(token);
      setDoctors(fetchedDoctors);
      if (fetchedDoctors.length > 0) {
        const doctorIds = fetchedDoctors.map(doc => doc.id);
        const fetchedCases = await getAllCasesForDoctors(token, doctorIds);
        setCases(fetchedCases);
      } else {
        setCases([]);
        toast({ title: "No Doctors Found", description: "No doctors available after filtering." });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCaseStatus = async (caseId: string, newStatus: CaseStatus): Promise<{ success: boolean; updatedCase?: Case }> => {
    if (!authToken) {
      throw new Error("Not authenticated");
    }
    // The actual API call is now wrapped and handled within DoctorCaseTable for local state management,
    // but the API function itself is passed down.
    return apiUpdateCaseStatus(authToken.token, caseId, newStatus);
  };


  if (!authToken) {
    return (
      <AuthForm
        onLoginSuccess={handleLoginSuccess}
        loginApiCall={apiLogin}
      />
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto my-10">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error Fetching Data</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  
  // isLoading for the table component is now managed by DoctorCaseTable using its 'initialLoading' prop.
  // page.tsx's isLoading state is for the initial login->data fetch sequence.
  if (isLoading && cases.length === 0) { // Show page-level loader only if no cases yet and still loading.
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading case data...</p>
      </div>
    );
  }


  return (
    <div className="container mx-auto py-2">
      <h2 className="text-3xl font-bold tracking-tight mb-6 text-center text-primary">Doctor Case Submissions</h2>
      <DoctorCaseTable 
        data={cases} 
        updateCaseStatusApi={(tokenFromTable, caseId, newStatus) => apiUpdateCaseStatus(tokenFromTable, caseId, newStatus)} // Pass the raw API function
        authToken={authToken.token}
        isLoading={isLoading && cases.length === 0} // Pass initial loading state to table
      />
    </div>
  );
}
