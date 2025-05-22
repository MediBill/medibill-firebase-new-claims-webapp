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
} from "@tanstack/react-table";
import * as XLSX from 'xlsx';

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

interface DoctorCaseTableProps {
  data: Case[];
  updateCaseStatusApi: (token: string, caseId: string, newStatus: CaseStatus) => Promise<{ success: boolean; updatedCase?: Case }>;
  authToken: string | null;
  isLoading: boolean;
}

export function DoctorCaseTable({ data, updateCaseStatusApi, authToken, isLoading: initialLoading }: DoctorCaseTableProps) {
  const { toast } = useToast();
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState(''); // Not directly used by ShadCN example, usually column specific

  const [isExporting, setIsExporting] = React.useState(false);
  const [updatingStatusMap, setUpdatingStatusMap] = React.useState<Record<string, boolean>>({});
  const [tableData, setTableData] = React.useState<Case[]>(data);

  React.useEffect(() => {
    setTableData(data);
  }, [data]);


  const handleUpdateStatus = async (caseId: string, newStatus: CaseStatus) => {
    if (!authToken) {
      toast({ title: "Error", description: "Authentication token not found.", variant: "destructive" });
      return;
    }
    setUpdatingStatusMap(prev => ({ ...prev, [caseId]: true }));
    try {
      const result = await updateCaseStatusApi(authToken, caseId, newStatus);
      if (result.success && result.updatedCase) {
        setTableData(prevData => prevData.map(c => c.id === caseId ? { ...c, ...result.updatedCase } : c));
        toast({ title: "Success", description: `Case ${result.updatedCase.caseNumber} status updated to ${newStatus}.` });
      } else {
        throw new Error("Failed to update status.");
      }
    } catch (error) {
      toast({ title: "Error updating status", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
      // Optionally revert optimistic update if any
    } finally {
      setUpdatingStatusMap(prev => ({ ...prev, [caseId]: false }));
    }
  };
  
  const isUpdatingStatus = (caseId: string) => !!updatingStatusMap[caseId];

  const columns = React.useMemo(() => getColumns(handleUpdateStatus, isUpdatingStatus), [handleUpdateStatus, isUpdatingStatus]);

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
        // Customize exported data structure if needed
        const originalData = row.original as Case;
        return {
          "Case Number": originalData.caseNumber,
          "Patient Name": originalData.patientName,
          "Doctor": originalData.doctorName,
          "Submitted Date": format(new Date(originalData.submittedDate), "yyyy-MM-dd"),
          "Insurance Provider": originalData.insuranceProvider,
          "Amount": originalData.amount,
          "Status": originalData.status,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Cases");
      XLSX.writeFile(workbook, "MediBill_Cases_Export.xlsx");
      toast({ title: "Export Successful", description: "Case data has been exported to Excel." });
    } catch (error) {
      toast({ title: "Export Failed", description: "An error occurred during export.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
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
        <Skeleton className="h-10 w-full" /> {/* Placeholder for table header */}
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" /> // Placeholder for table rows
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
    <div className="space-y-4 p-4 border rounded-lg shadow-sm bg-card">
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
                  className="hover:bg-muted/30"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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
    </div>
  );
}
