
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
import type { Case, CaseStatus } from "@/types/medibill";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CaseDetailSheet } from "./case-detail-sheet";


interface DoctorCaseTableProps {
  data: Case[];
  updateCaseStatusApi: (token: string, caseId: number, newStatus: CaseStatus) => Promise<{ success: boolean; updatedCase?: Case }>;
  authToken: string | null;
  isLoading: boolean;
}

export function DoctorCaseTable({ data, updateCaseStatusApi, authToken, isLoading: initialLoading }: DoctorCaseTableProps) {
  const { toast } = useToast();
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
     // Example: Hide doctor_acc_no by default if it's too technical for main view
     // doctor_acc_no: false, 
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([
    {
      id: 'status',
      value: 'NEW',
    }
  ]);
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'service_date', desc: true } // Sort by service_date descending by default
  ]);
  const [globalFilter, setGlobalFilter] = React.useState(''); 

  const [isExporting, setIsExporting] = React.useState(false);
  const [updatingStatusMap, setUpdatingStatusMap] = React.useState<Record<number, boolean>>({}); // Case ID is now number
  const [tableData, setTableData] = React.useState<Case[]>(data);

  const [selectedCase, setSelectedCase] = React.useState<Case | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  React.useEffect(() => {
    setTableData(data);
  }, [data]);


  const handleUpdateStatusInTableAndSheet = (caseId: number, newStatus: CaseStatus, updatedCase?: Case) => {
    setTableData(prevData => 
        prevData.map(c => (c.id === caseId && updatedCase ? { ...c, ...updatedCase, status: newStatus } : c))
    );
    if (selectedCase && selectedCase.id === caseId) {
        setSelectedCase(prev => prev ? { ...prev, status: newStatus, ...(updatedCase || {}) } : null);
    }
  };

  const handleUpdateStatus = async (caseId: number, newStatus: CaseStatus) => {
    if (!authToken) {
      toast({ title: "Error", description: "Authentication token not found.", variant: "destructive" });
      return;
    }
    setUpdatingStatusMap(prev => ({ ...prev, [caseId]: true }));
    try {
      const result = await updateCaseStatusApi(authToken, caseId, newStatus);
      if (result.success && result.updatedCase) {
        handleUpdateStatusInTableAndSheet(caseId, newStatus, result.updatedCase);
        toast({ title: "Success", description: `Case ID ${result.updatedCase.id} status updated to ${newStatus}.` });
      } else {
        throw new Error("Failed to update status from API.");
      }
    } catch (error) {
      toast({ title: "Error updating status", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setUpdatingStatusMap(prev => ({ ...prev, [caseId]: false }));
    }
  };
  
  const isUpdatingStatus = (caseId: number) => !!updatingStatusMap[caseId];

  const columns = React.useMemo(() => getColumns(handleUpdateStatus, isUpdatingStatus), [authToken, tableData]); 

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
    meta: { // Pass functions or data to columns
        updateStatus: handleUpdateStatus,
        isUpdatingStatus: isUpdatingStatus,
    }
  });

  const handleExport = () => {
    setIsExporting(true);
    try {
      const dataToExport = table.getFilteredRowModel().rows.map(row => {
        const originalData = row.original as Case;
        // Map to a simpler structure for export, include more fields if needed
        return {
          "Case ID": originalData.id,
          "Patient Name": originalData.patient_name,
          "Treating Surgeon": originalData.treating_surgeon,
          "Service Date": originalData.service_date ? format(parseISO(originalData.submittedDateTime), "yyyy-MM-dd") : "N/A",
          "Start Time": originalData.start_time || "N/A",
          "End Time": originalData.end_time || "N/A",
          "Status": originalData.status,
          "ICD10 Codes": originalData.icd10_codes?.join(', ') || "N/A",
          "Procedure Codes": originalData.procedure_codes?.join(', ') || "N/A",
          "Notes": originalData.notes || "N/A",
          // Add more fields from originalData as required for export
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
                  className="hover:bg-accent/20 cursor-pointer transition-colors" // Enhanced hover effect
                  onClick={(event) => {
                    let target = event.target as HTMLElement;
                    let isInteractiveClick = false;
                    // Check if the click originated from an interactive element within the row
                    while (target && target !== event.currentTarget) {
                        if (target.dataset.radixSelectTrigger !== undefined || 
                            target.closest('[data-radix-select-content]') !== null ||
                            target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox' ||
                            target.closest('button:not([data-disables-row-click="true"])') !== null || // Check for buttons, allow disabling row click for specific buttons
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
        <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col"> {/* Increased width to 2xl */}
          {selectedCase && (
            <CaseDetailSheet 
              caseDetails={selectedCase} 
              onClose={() => setIsSheetOpen(false)}
              onUpdateStatus={async (newStatus) => {
                if (selectedCase && authToken) {
                  // Optimistically update sheet, table will update on success
                  setSelectedCase(prev => prev ? {...prev, status: newStatus} : null);
                  await handleUpdateStatus(selectedCase.id, newStatus);
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
