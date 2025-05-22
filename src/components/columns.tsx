"use client";

import type { ColumnDef, Row, Column } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Case, CaseStatus } from "@/types/medibill";
import { format } from 'date-fns';

const availableStatuses: CaseStatus[] = ['NEW', 'PENDING', 'APPROVED', 'REJECTED'];

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
        return format(new Date(date as string), "PP"); // 'PP' for localized date format e.g. May 01, 2024
      } catch (error) {
        return date as string; // Fallback to original string if date is invalid
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
        <Select
          value={currentStatus}
          onValueChange={(value) => {
            onUpdateStatus(currentCase.id, value as CaseStatus);
          }}
          disabled={updating}
        >
          <SelectTrigger className="w-[120px] h-8 data-[disabled]:opacity-70 data-[disabled]:cursor-not-allowed">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {availableStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  // Example for an actions column, can be customized or removed
  // {
  //   id: "actions",
  //   cell: ({ row }) => {
  //     const payment = row.original;
  //     return (
  //       <DropdownMenu>
  //         <DropdownMenuTrigger asChild>
  //           <Button variant="ghost" className="h-8 w-8 p-0">
  //             <span className="sr-only">Open menu</span>
  //             <MoreHorizontal className="h-4 w-4" />
  //           </Button>
  //         </DropdownMenuTrigger>
  //         <DropdownMenuContent align="end">
  //           <DropdownMenuLabel>Actions</DropdownMenuLabel>
  //           <DropdownMenuItem onClick={() => navigator.clipboard.writeText(payment.id)}>
  //             Copy case ID
  //           </DropdownMenuItem>
  //           <DropdownMenuSeparator />
  //           <DropdownMenuItem>View patient details</DropdownMenuItem>
  //           <DropdownMenuItem>View doctor details</DropdownMenuItem>
  //         </DropdownMenuContent>
  //       </DropdownMenu>
  //     );
  //   },
  // },
];
