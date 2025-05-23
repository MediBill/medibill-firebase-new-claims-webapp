
"use client";

import type { ColumnDef, Row, Column } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, CheckCircle, Tag, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Case, CaseStatus, ApiCase } from "@/types/medibill";
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";

const availableStatuses: CaseStatus[] = ['NEW', 'PROCESSED'];

interface DataTableColumnHeaderProps<TData, TValue> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>
  title: string
}

export function DataTableColumnHeader<TData, TValue>({ column, title, className }: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={className}>{title}</div>
  }

  return (
    <div className={className ? `${className} flex items-center space-x-2` : "flex items-center space-x-2"}>
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {title}
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}

const getStatusBadgeVariant = (status: CaseStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'NEW': return 'outline'; 
    case 'PROCESSED': return 'default'; 
    default: return 'outline';
  }
};

const getStatusBadgeIcon = (status: CaseStatus) => {
  switch (status) {
    case 'NEW': return <Tag className="h-3.5 w-3.5" />;
    case 'PROCESSED': return <CheckCircle className="h-3.5 w-3.5" />;
    default: return null;
  }
};


export const getColumns = (
  // This function now expects the full case object and the new status
  onTriggerStatusUpdate: (caseToUpdate: Case, newStatus: CaseStatus) => Promise<void>,
  isUpdatingStatus: (caseId: number) => boolean
): ColumnDef<Case>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
        onClick={(e) => e.stopPropagation()} 
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "id",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Case ID" />,
    cell: ({ row }) => <div className="font-medium">{row.getValue("id")}</div>,
  },
  {
    accessorKey: "service_date",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Service Date" />,
    cell: ({ row }) => {
      const date = row.getValue("service_date");
      try {
        return format(new Date(date as string), "PP"); 
      } catch (error) {
        return date as string; 
      }
    },
  },
  {
    accessorKey: "doctor_acc_no",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Doctor Acc No" />,
    cell: ({ row }) => <div>{row.getValue("doctor_acc_no")}</div>,
  },
  {
    accessorKey: "patient_name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Patient Name" />,
  },
  {
    accessorKey: "treating_surgeon",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Treating Surgeon" />,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const currentCase = row.original;
      const currentStatus = currentCase.status;
      const updating = isUpdatingStatus(currentCase.id);

      return (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center space-x-2">
          <Badge variant={getStatusBadgeVariant(currentStatus)} className="px-2.5 py-1 text-xs whitespace-nowrap">
            {getStatusBadgeIcon(currentStatus)}
            <span className="ml-1">{currentStatus}</span>
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 data-[state=open]:bg-muted" disabled={updating}>
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Change status</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Update Status</DropdownMenuLabel>
              {availableStatuses.map((statusOption) => (
                <DropdownMenuItem
                  key={statusOption}
                  onClick={() => onTriggerStatusUpdate(currentCase, statusOption)} // Pass the full case and new status
                  disabled={currentStatus === statusOption || updating}
                  className="capitalize"
                >
                  {statusOption}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
];
