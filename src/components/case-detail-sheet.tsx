
"use client";

import type * as React from 'react';
import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"; // SheetContent is used by the parent
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Case, CaseStatus } from "@/types/medibill";
import { format } from 'date-fns';
import { CalendarDays, User, BriefcaseMedical, FileText, Banknote, Tag, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from '@/components/ui/scroll-area';

interface CaseDetailSheetProps {
  caseDetails: Case;
  onClose: () => void;
  onUpdateStatus: (newStatus: CaseStatus) => Promise<void>;
  isUpdatingStatus: boolean;
}

const availableStatuses: CaseStatus[] = ['NEW', 'PENDING', 'APPROVED', 'REJECTED'];

const getStatusVariant = (status: CaseStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'APPROVED':
      return 'default'; // Greenish if you customize theme, or primary
    case 'REJECTED':
      return 'destructive';
    case 'PENDING':
      return 'secondary'; // Yellowish/Orange if customized, or secondary
    case 'NEW':
      return 'outline'; // Blueish or neutral
    default:
      return 'outline';
  }
};

const getStatusIcon = (status: CaseStatus) => {
  switch (status) {
    case 'APPROVED':
      return <CheckCircle className="mr-2 h-4 w-4 text-green-500" />;
    case 'REJECTED':
      return <XCircle className="mr-2 h-4 w-4 text-red-500" />;
    case 'PENDING':
      return <Clock className="mr-2 h-4 w-4 text-yellow-500" />;
    case 'NEW':
      return <Tag className="mr-2 h-4 w-4 text-blue-500" />;
    default:
      return <AlertTriangle className="mr-2 h-4 w-4" />;
  }
};


export function CaseDetailSheet({ caseDetails, onClose, onUpdateStatus, isUpdatingStatus }: CaseDetailSheetProps) {
  const {
    caseNumber,
    patientName,
    doctorName,
    submittedDate,
    insuranceProvider,
    amount,
    status,
  } = caseDetails;

  const formattedDate = submittedDate ? format(new Date(submittedDate), "MMMM d, yyyy 'at' h:mm a") : "N/A";
  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

  return (
    <ScrollArea className="h-full">
    <div className="flex flex-col h-full">
      <SheetHeader className="p-6 bg-muted/30 border-b">
        <SheetTitle className="text-2xl text-primary flex items-center">
          <FileText className="mr-3 h-7 w-7" /> Case Details
        </SheetTitle>
        <SheetDescription>
          Viewing case <span className="font-semibold text-foreground">{caseNumber}</span> for patient <span className="font-semibold text-foreground">{patientName}</span>.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-grow p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <DetailItem icon={<User className="text-primary" />} label="Patient Name" value={patientName} />
          <DetailItem icon={<BriefcaseMedical className="text-primary" />} label="Doctor" value={doctorName || "N/A"} />
          <DetailItem icon={<CalendarDays className="text-primary" />} label="Submitted Date" value={formattedDate} />
          <DetailItem icon={<Banknote className="text-primary" />} label="Insurance Provider" value={insuranceProvider} />
          <DetailItem icon={<FileText className="text-primary" />} label="Case Number" value={caseNumber} />
          <DetailItem icon={<Tag className="text-primary" />} label="Claim Amount" value={formattedAmount} />
        </div>
        
        <Separator />

        <div>
          <h4 className="text-md font-semibold mb-2 text-foreground flex items-center">
            <Tag className="mr-2 h-5 w-5 text-primary" /> Status
          </h4>
          <div className="flex items-center space-x-3">
             <Badge variant={getStatusVariant(status)} className="text-sm px-3 py-1">
                {getStatusIcon(status)}
                {status}
              </Badge>
            <Select
              value={status}
              onValueChange={(value) => onUpdateStatus(value as CaseStatus)}
              disabled={isUpdatingStatus}
            >
              <SelectTrigger className="w-[180px] h-9 shadow-sm data-[disabled]:opacity-70 data-[disabled]:cursor-not-allowed">
                <SelectValue placeholder="Update status" />
              </SelectTrigger>
              <SelectContent>
                {availableStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Placeholder for future AI insights or notes */}
        {/* <Separator />
        <div>
          <h4 className="text-md font-semibold mb-2 text-foreground">AI Insights & Notes</h4>
          <p className="text-sm text-muted-foreground">Insights related to this case will appear here.</p>
        </div> */}
      </div>

      <SheetFooter className="p-6 border-t bg-muted/30 mt-auto">
        <SheetClose asChild>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </SheetClose>
      </SheetFooter>
    </div>
    </ScrollArea>
  );
}

interface DetailItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

const DetailItem: React.FC<DetailItemProps> = ({ icon, label, value }) => (
  <div className="flex items-start space-x-3 py-2">
    <div className="flex-shrink-0 w-6 h-6 mt-0.5">{icon}</div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  </div>
);

