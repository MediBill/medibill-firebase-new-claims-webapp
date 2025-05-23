
"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type Row,
} from "@tanstack/react-table";
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";
import { getColumns } from "./columns";
import type { Case, CaseStatus, ApiCase } from "@/types/medibill";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CaseDetailSheet } from "./case-detail-sheet";


interface DoctorCaseTableProps {
  data: Case[];
  // This prop now expects the full case update (token, caseId, payload)
  updateCaseApi: (token: string, caseId: number, payload: Partial<ApiCase>) => Promise<{ success: boolean; updatedCase?: Case }>;
  authToken: string | null; // Auth token string
  isLoading: boolean;
}

// Helper to map client-side Case object to the payload expected by the external API
const mapCaseToApiCasePayload = (caseObj: Case, newStatus: CaseStatus): Partial<ApiCase> => {
  const { 
    status, // client-side processed status
    submittedDateTime, // client-side constructed field
    original_case_status, // client-side tracking field
    // any other fields specific to 'Case' type and not in 'ApiCase'
    ...apiCompatibleFields 
  } = caseObj;

  // Ensure all fields required by the API are present, even if null from source
  const payload: Partial<ApiCase> = {
    id: apiCompatibleFields.id,
    doctor_acc_no: apiCompatibleFields.doctor_acc_no,
    patient_name: apiCompatibleFields.patient_name,
    treating_surgeon: apiCompatibleFields.treating_surgeon,
    weight: apiCompatibleFields.weight,
    height: apiCompatibleFields.height,
    service_date: apiCompatibleFields.service_date,
    start_time: apiCompatibleFields.start_time,
    end_time: apiCompatibleFields.end_time,
    icd10_codes: apiCompatibleFields.icd10_codes,
    procedure_codes: apiCompatibleFields.procedure_codes,
    consultations: apiCompatibleFields.consultations,
    ortho_modifiers: apiCompatibleFields.ortho_modifiers,
    procedures: apiCompatibleFields.procedures,
    modifiers: apiCompatibleFields.modifiers,
    bp_start_time: apiCompatibleFields.bp_start_time,
    bp_end_time: apiCompatibleFields.bp_end_time,
    hospital_sticker_image_url: apiCompatibleFields.hospital_sticker_image_url,
    admission_form_image_url: apiCompatibleFields.admission_form_image_url,
    notes: apiCompatibleFields.notes,
    birth_weight: apiCompatibleFields.birth_weight,
    primary_assistant: apiCompatibleFields.primary_assistant,
    secondary_assistant: apiCompatibleFields.secondary_assistant,
    referring_service_provider: apiCompatibleFields.referring_service_provider,
    referred_by_icd10: apiCompatibleFields.referred_by_icd10,
    asa_level: apiCompatibleFields.asa_level,
    case_status: newStatus, // Set the case_status to the new desired status string
  };
  return payload;
};


export function DoctorCaseTable({ data, updateCaseApi, authToken, isLoading: initialLoading }: DoctorCaseTableProps) {
  const { toast } = useToast();
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([
    { id: 'status', value: 'NEW' }
  ]);
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'service_date', desc: true }
  ]);
  const [globalFilter, setGlobalFilter] = React.useState(''); 

  const [isExporting, setIsExporting] = React.useState(false);
  const [updatingStatusMap, setUpdatingStatusMap] = React.useState<Record<number, boolean>>({});
  const [tableData, setTableData] = React.useState<Case[]>(data);

  const [selectedCase, setSelectedCase] = React.useState<Case | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  React.useEffect(() => {
    setTableData(data);
  }, [data]);


  const handleSuccessfulUpdateInTable = (caseId: number, newStatus: CaseStatus, updatedCaseFromApi?: Case) => {
    setTableData(prevData => 
        prevData.map(c => (c.id === caseId ? { ...c, status: newStatus, ...(updatedCaseFromApi || {}) } : c))
    );
    if (selectedCase && selectedCase.id === caseId) {
        setSelectedCase(prev => prev ? { ...prev, status: newStatus, ...(updatedCaseFromApi || {}) } : null);
    }
  };

  // This function is called by columns.tsx and CaseDetailSheet.tsx
  const triggerCaseStatusUpdate = async (caseToUpdate: Case, newStatus: CaseStatus) => {
    if (!authToken) {
      toast({ title: "Error", description: "Authentication token not found.", variant: "destructive" });
      return;
    }
    if (!caseToUpdate) {
      toast({ title: "Error", description: "Case data not found for update.", variant: "destructive" });
      return;
    }

    setUpdatingStatusMap(prev => ({ ...prev, [caseToUpdate.id]: true }));
    
    const payloadForApi = mapCaseToApiCasePayload(caseToUpdate, newStatus);
    console.log('[DoctorCaseTable] Payload for API update:', payloadForApi);

    try {
      // Call the prop which points to apiUpdateCase in page.tsx (which in turn calls lib/medibill-api#updateCase)
      const result = await updateCaseApi(authToken, caseToUpdate.id, payloadForApi); 
      
      if (result.success && result.updatedCase) {
        handleSuccessfulUpdateInTable(caseToUpdate.id, newStatus, result.updatedCase);
        toast({ title: "Success", description: `Case ID ${result.updatedCase.id} status updated to ${newStatus}.` });
      } else {
        // Error message for failure will be based on what updateCaseApi (and ultimately updateCase in medibill-api) returns or throws
        throw new Error( "Failed to update status. API did not confirm success or provide updated case.");
      }
    } catch (error) {
      toast({ title: "Error updating status", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setUpdatingStatusMap(prev => ({ ...prev, [caseToUpdate.id]: false }));
    }
  };
  
  const isUpdatingStatus = (caseId: number) => !!updatingStatusMap[caseId];

  // Pass triggerCaseStatusUpdate, which expects the full case object and the new status string.
  const columns = React.useMemo(() => getColumns(triggerCaseStatusUpdate, isUpdatingStatus), [authToken, tableData, updatingStatusMap]); 

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      globalFilter,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const handleExport = () => {
    setIsExporting(true);
    try {
      const dataToExport = table.getFilteredRowModel().rows.map(row => {
        const originalData = row.original as Case;
        return {
          "Case ID": originalData.id,
          "Patient Name": originalData.patient_name,
          "Treating Surgeon": originalData.treating_surgeon,
          "Service Date": originalData.service_date ? format(parseISO(originalData.service_date), "yyyy-MM-dd") : "N/A",
          "Start Time": originalData.start_time || "N/A",
          "End Time": originalData.end_time || "N/A",
          "Status": originalData.status,
          "ICD10 Codes": originalData.icd10_codes?.join(', ') || "N/A",
          "Procedure Codes": originalData.procedure_codes?.join(', ') || "N/A",
          "Notes": originalData.notes || "N/A",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Cases");
      XLSX.writeFile(workbook, "MediBill_Cases_Export.xlsx");
      toast({ title: "Export Successful", description: "Case data has been exported to Excel." });
    } catch (error) {
      console.error("Export error:", error);
      toast({ title: "Export Failed", description: "An error occurred during export.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRowClick = (row: Row<Case>) => {
    setSelectedCase(row.original);
    setIsSheetOpen(true);
  };

  if (initialLoading) {
     return (
      <div className="space-y-4 p-4 border rounded-lg shadow-sm bg-card">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-[250px]" />
          <div className="flex space-x-2">
            <Skeleton className="h-10 w-[150px]" />
            <Skeleton className="h-10 w-[120px]" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" /> 
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" /> 
        ))}
        <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-8 w-[150px]" />
            <div className="flex space-x-2">
                <Skeleton className="h-8 w-[70px]" />
                <Skeleton className="h-8 w-[100px]" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg shadow-sm bg-card mt-6">
      <DataTableToolbar table={table} onExport={handleExport} isExporting={isExporting} />
      <div className="rounded-md border shadow-inner">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan} className="bg-muted/50">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-accent/20 cursor-pointer transition-colors"
                  onClick={(event) => {
                    let target = event.target as HTMLElement;
                    let isInteractiveClick = false;
                    // Check if the click originated from an interactive element within the row
                    while (target && target !== event.currentTarget) {
                        if (target.dataset.radixSelectTrigger !== undefined || 
                            target.closest('[data-radix-select-content]') !== null ||
                            target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox' ||
                            target.closest('button:not([data-disables-row-click="true"])') !== null || // ensure button isn't specifically meant to NOT disable row click
                            target.closest('[role="menuitem"]') !== null ) {
                            isInteractiveClick = true;
                            break;
                        }
                        target = target.parentElement as HTMLElement;
                    }
                    if (!isInteractiveClick) {
                        handleRowClick(row);
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
          {selectedCase && (
            <CaseDetailSheet 
              caseDetails={selectedCase} 
              onClose={() => setIsSheetOpen(false)}
              // This prop now just signals the new status string
              onUpdateStatus={async (newStatus) => { 
                if (selectedCase) {
                  // Optimistically update sheet's view of the case
                  setSelectedCase(prev => prev ? {...prev, status: newStatus} : null);
                  // Call the main handler in DoctorCaseTable to construct payload and make API call
                  await triggerCaseStatusUpdate(selectedCase, newStatus);
                }
              }}
              isUpdatingStatus={selectedCase ? isUpdatingStatus(selectedCase.id) : false}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
