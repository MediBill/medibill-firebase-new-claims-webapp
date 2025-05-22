
"use client"

import type { Table } from "@tanstack/react-table"
import { Columns, Download, Filter, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CaseStatus } from "@/types/medibill"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  onExport: () => void;
  isExporting: boolean;
}

const availableStatuses: CaseStatus[] = ['NEW', 'PROCESSED'];

export function DataTableToolbar<TData>({
  table,
  onExport,
  isExporting,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0
  const statusColumn = table.getColumn("status");

  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex flex-1 items-center space-x-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cases..."
            value={(table.getColumn("patient_name")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              // Filtering multiple columns for global search is better
              // For simplicity, filtering patient_name.
              {
                table.getColumn("patient_name")?.setFilterValue(event.target.value)
              }
            }
            className="h-10 w-[150px] lg:w-[250px] pl-10 rounded-md shadow-sm"
          />
        </div>

        {statusColumn && (
           <Select
            value={(statusColumn.getFilterValue() as string) ?? ""}
            onValueChange={(value) => {
              if (value === "ALL") {
                statusColumn.setFilterValue(undefined);
              } else {
                statusColumn.setFilterValue(value);
              }
            }}
          >
            <SelectTrigger className="h-10 w-[180px] rounded-md shadow-sm data-[state=open]:ring-2 data-[state=open]:ring-ring">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Filter by status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {availableStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {isFiltered && table.getColumn("status")?.getFilterValue() !== 'NEW' && ( // Only show reset if not the default NEW filter or other filters are active
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters();
              table.getColumn("status")?.setFilterValue("NEW"); // Re-apply default NEW filter after resetting all
            }}
            className="h-10 px-2 lg:px-3 hover:bg-destructive/10 text-destructive"
          >
            Reset Filters
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
         {isFiltered && table.getColumn("status")?.getFilterValue() === 'NEW' && table.getState().columnFilters.filter(cf => cf.id !== 'status').length > 0 && (
           // handles case where "NEW" is selected but other filters are also active
            <Button
                variant="ghost"
                onClick={() => {
                    const patientNameFilterValue = table.getColumn("patient_name")?.getFilterValue();
                    table.resetColumnFilters();
                    table.getColumn("status")?.setFilterValue("NEW");
                    if(patientNameFilterValue) table.getColumn("patient_name")?.setFilterValue(patientNameFilterValue);
                }}
                className="h-10 px-2 lg:px-3 hover:bg-accent text-accent-foreground"
            >
                Clear Search
                <X className="ml-2 h-4 w-4" />
            </Button>
         )}
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          className="h-10 rounded-md shadow-sm"
          onClick={onExport}
          disabled={isExporting}
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Exporting..." : "Export to Excel"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto hidden h-10 lg:flex rounded-md shadow-sm"
            >
              <Columns className="mr-2 h-4 w-4" />
              View Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter(
                (column) =>
                  typeof column.accessorFn !== "undefined" && column.getCanHide()
              )
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()} {/* Prettify column id */}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
