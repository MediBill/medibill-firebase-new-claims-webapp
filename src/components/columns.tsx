
"use client";

import type { ColumnDef, Row, Column } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, CheckCircle, Tag } from "lucide-react"; // Removed Clock, XCircle
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
import type { Case, CaseStatus } from "@/types/medibill";
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
    case 'NEW': return 'outline'; // Neutral or blueish
    case 'PROCESSED': return 'default'; // Often green-ish by default in themes
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
  onUpdateStatus: (caseId: string, newStatus: CaseStatus) => Promise<void>,
  isUpdatingStatus: (caseId: string) => boolean
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
        onClick={(e) => e.stopPropagation()} // Prevent row click when interacting with checkbox
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "caseNumber",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Case Number" />,
    cell: ({ row }) => <div className="font-medium">{row.getValue("caseNumber")}</div>,
  },
  {
    accessorKey: "patientName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Patient Name" />,
  },
  {
    accessorKey: "doctorName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Doctor" />,
  },
  {
    accessorKey: "submittedDate",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Submitted Date" />,
    cell: ({ row }) => {
      const date = row.getValue("submittedDate");
      try {
        return format(new Date(date as string), "PP"); 
      } catch (error) {
        return date as string; 
      }
    },
  },
  {
    accessorKey: "insuranceProvider",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Insurance Provider" />,
  },
  {
    accessorKey: "amount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"));
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);
      return <div className="text-right font-medium">{formatted}</div>;
    },
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
                  onClick={() => onUpdateStatus(currentCase.id, statusOption)}
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
