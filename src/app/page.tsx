
"use client";

import type * as React from 'react';
import { useState, useEffect } from 'react';
import { AuthForm } from '@/components/auth-form';
import { DoctorCaseTable } from '@/components/doctor-case-table';
import { login as apiLogin, getDoctors, getAllCasesForDoctors, updateCaseStatus as apiUpdateCaseStatus } from '@/lib/medibill-api';
import type { AuthToken, Doctor, Case, CaseStatus } from '@/types/medibill'; // Case is now the processed type
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

export default function MediBillPage() {
  const [authToken, setAuthToken] = useState<AuthToken | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(false); 
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
        const doctorAccNos = fetchedDoctors.map(doc => doc.id); // Assuming doc.id is the account number
        const fetchedCases = await getAllCasesForDoctors(token, doctorAccNos);
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

  // This function is passed to DoctorCaseTable, which now expects caseId as number
  const handleUpdateCaseStatus = async (caseId: number, newStatus: CaseStatus): Promise<{ success: boolean; updatedCase?: Case }> => {
    if (!authToken) {
      // This should ideally be handled by disabling UI elements if not authenticated
      toast({ title: "Authentication Error", description: "Not authenticated.", variant: "destructive" });
      return { success: false };
    }
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
  
  if (isLoading && cases.length === 0) { 
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
        updateCaseStatusApi={(tokenFromTable, caseId, newStatus) => apiUpdateCaseStatus(tokenFromTable, caseId, newStatus)}
        authToken={authToken.token}
        isLoading={isLoading && cases.length === 0} 
      />
    </div>
  );
}
