
"use client";

import type * as React from 'react';
import { useState, useEffect } from 'react';
import { AuthForm } from '@/components/auth-form';
import { DoctorCaseTable } from '@/components/doctor-case-table';
// Import the actual login function from medibill-api
import { login as apiLoginReal, getDoctors, getAllCasesForDoctors, updateCase as apiUpdateCase } from '@/lib/medibill-api';
import type { AuthToken, Doctor, Case, CaseStatus, ApiCase } from '@/types/medibill';
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
    if (!authToken) {
        setIsLoading(false); 
    }
  }, [authToken]);

  const handleLoginSuccess = (token: AuthToken) => {
    console.log("[Page] Login successful, token received:", token ? token.token.substring(0,10) + "..." : "null");
    setAuthToken(token);
    setError(null);
    setIsLoading(true); 
    fetchData(token.token);
  };

  const apiLogin = async (password: string): Promise<AuthToken> => {
    return apiLoginReal(password);
  };

  const fetchData = async (token: string) => {
    console.log("[Page] fetchData called with token:", token ? token.substring(0,10) + "..." : "null");
    setIsLoading(true);
    setError(null);
    try {
      console.log("[Page] Attempting to fetch doctors...");
      const fetchedDoctors = await getDoctors(token);
      console.log("[Page] Fetched doctors raw:", fetchedDoctors);
      setDoctors(fetchedDoctors);

      if (fetchedDoctors && fetchedDoctors.length > 0) {
        const doctorAccNos = fetchedDoctors.map(doc => doc.id); // doc.id is the user_id
        console.log("[Page] Doctor Account Numbers (user_ids) for case fetching:", doctorAccNos);
        
        console.log("[Page] Attempting to fetch cases for these doctors...");
        const fetchedCases = await getAllCasesForDoctors(token, doctorAccNos);
        console.log("[Page] Fetched cases raw:", fetchedCases);
        setCases(fetchedCases);
        console.log("[Page] Cases state *after* setCases:", fetchedCases); // Log what was set
        if (fetchedCases.length === 0) {
            toast({ title: "No Cases Found", description: "No cases were returned for the available doctors." });
        }
      } else {
        setCases([]); 
        toast({ title: "No Doctors Found", description: "No doctors available after filtering. Cannot fetch cases." });
        console.log("[Page] No doctors found or an empty array was returned by getDoctors.");
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
  
  useEffect(() => {
    console.log("[Page] Cases state updated in useEffect:", cases);
  }, [cases]);


  const handleCaseUpdateAttempt = async (caseId: number, updatedCasePayload: Partial<ApiCase>): Promise<{ success: boolean; updatedCase?: Case }> => {
    if (!authToken) {
      toast({ title: "Authentication Error", description: "Not authenticated.", variant: "destructive" });
      return { success: false };
    }
    // This now calls the general updateCase function from medibill-api
    return apiUpdateCase(authToken.token, caseId, updatedCasePayload);
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
        // Pass the general update function
        updateCaseApi={handleCaseUpdateAttempt}
        authToken={authToken.token} 
        isLoading={isLoading}
      />
    </div>
  );
}
