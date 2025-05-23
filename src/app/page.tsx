
"use client";

import type * as React from 'react';
import { useState, useEffect } from 'react';
import { AuthForm } from '@/components/auth-form';
import { DoctorCaseTable } from '@/components/doctor-case-table';
// Import the actual login function from medibill-api
import { login as apiLoginReal, getDoctors, getAllCasesForDoctors, updateCaseStatus as apiUpdateCaseStatus } from '@/lib/medibill-api';
import type { AuthToken, Doctor, Case, CaseStatus } from '@/types/medibill';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

export default function MediBillPage() {
  const [authToken, setAuthToken] = useState<AuthToken | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true); // True initially until first data fetch attempt
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // On initial load, if there's no token, we are in the login state.
    // If a token were persisted (e.g. localStorage), we'd try to load and use it here.
    // For now, isLoading controls the display until login or data fetch.
    if (!authToken) {
        setIsLoading(false); // Stop loading if we are waiting for login
    }
  }, [authToken]);

  const handleLoginSuccess = (token: AuthToken) => {
    console.log("[Page] Login successful, token received:", token ? token.token.substring(0,10) + "..." : "null");
    setAuthToken(token);
    setError(null);
    setIsLoading(true); // Start loading for data fetch
    fetchData(token.token);
  };

  // Wrapper for the API login call to match AuthForm's expected signature (password only)
  const apiLogin = async (password: string): Promise<AuthToken> => {
    // The email is hardcoded within apiLoginReal or not needed by it if it's a general app password
    return apiLoginReal(password);
  };

  const fetchData = async (token: string) => {
    console.log("[Page] fetchData called with token:", token ? token.substring(0,10) + "..." : "null");
    setIsLoading(true);
    setError(null);
    try {
      console.log("[Page] Attempting to fetch doctors...");
      const fetchedDoctors = await getDoctors(token);
      console.log("[Page] Fetched doctors:", fetchedDoctors);
      setDoctors(fetchedDoctors);

      if (fetchedDoctors && fetchedDoctors.length > 0) {
        const doctorAccNos = fetchedDoctors.map(doc => doc.id);
        console.log("[Page] Doctor Account Numbers for case fetching:", doctorAccNos);
        console.log("[Page] Attempting to fetch cases for these doctors...");
        const fetchedCases = await getAllCasesForDoctors(token, doctorAccNos);
        console.log("[Page] Fetched cases:", fetchedCases);
        setCases(fetchedCases);
        if (fetchedCases.length === 0) {
            toast({ title: "No Cases Found", description: "No cases were returned for the available doctors." });
        }
      } else {
        setCases([]); // No doctors, so no cases
        toast({ title: "No Doctors Found", description: "No doctors available after filtering. Cannot fetch cases." });
        console.log("[Page] No doctors found or an empty array was returned.");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      console.error("[Page] Error in fetchData:", errorMessage, err);
      setError(errorMessage);
      toast({ title: "Error Fetching Data", description: errorMessage, variant: "destructive" });
    } finally {
      console.log("[Page] fetchData completed.");
      setIsLoading(false);
    }
  };
  
  // Log cases state when it changes
  useEffect(() => {
    console.log("[Page] Cases state updated:", cases);
  }, [cases]);


  const handleUpdateCaseStatus = async (caseId: number, newStatus: CaseStatus): Promise<{ success: boolean; updatedCase?: Case }> => {
    if (!authToken) {
      toast({ title: "Authentication Error", description: "Not authenticated.", variant: "destructive" });
      return { success: false };
    }
    return apiUpdateCaseStatus(authToken.token, caseId, newStatus);
  };

  if (!authToken) {
    return (
      <AuthForm
        onLoginSuccess={handleLoginSuccess}
        loginApiCall={apiLogin} // Pass the apiLogin wrapper
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

  // Show loading spinner if isLoading is true AND we don't have an error.
  // If there's an error, the error Alert above takes precedence.
  // Also, only show "Loading case data..." if we expect cases (i.e., after login).
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Loading data...</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-2">
      <DoctorCaseTable
        data={cases}
        updateCaseStatusApi={(tokenFromTable, caseId, newStatus) => apiUpdateCaseStatus(tokenFromTable, caseId, newStatus)}
        authToken={authToken.token} // DoctorCaseTable expects string | null, authToken.token is string
        isLoading={isLoading} // Pass the loading state
      />
    </div>
  );
}

