
"use client";

import type * as React from 'react';
import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Case, CaseStatus } from "@/types/medibill";
import { format, parseISO } from 'date-fns';
import { CalendarDays, User, BriefcaseMedical, FileText, Tag, CheckCircle, AlertTriangle, Hash, Weight, Ruler, Clock, ListChecks, Image as ImageIcon, Edit3, Thermometer, Activity } from 'lucide-react'; // Added Baby, Activity
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image'; 
import { cn } from "@/lib/utils";

interface CaseDetailSheetProps {
  caseDetails: Case;
  onClose: () => void;
  onUpdateStatus: (newStatus: CaseStatus) => Promise<void>;
  isUpdatingStatus: boolean;
}

const availableStatuses: CaseStatus[] = ['NEW', 'PROCESSED'];

const getStatusVariant = (status: CaseStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'NEW': return 'outline';
    case 'PROCESSED': return 'default';
    default: return 'outline';
  }
};

const getStatusIcon = (status: CaseStatus) => {
  switch (status) {
    case 'NEW': return <Tag className="mr-2 h-4 w-4 text-blue-500" />;
    case 'PROCESSED': return <CheckCircle className="mr-2 h-4 w-4 text-green-500" />;
    default: return <AlertTriangle className="mr-2 h-4 w-4" />;
  }
};

const formatNullableArray = (arr?: string[] | null) => arr && arr.length > 0 ? arr.join(', ') : 'N/A';
const formatNullableString = (str?: string | null) => str || 'N/A';
const formatNullableNumber = (num?: number | null) => num !== null && num !== undefined ? num.toString() : 'N/A';

const TimeDisplay: React.FC<{ label: string, time?: string | null }> = ({ label, time }) => {
  if (!time) return <DetailItem icon={<Clock className="text-primary" />} label={label} value="N/A" />;
  try {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10));
    date.setMinutes(parseInt(minutes, 10));
    return <DetailItem icon={<Clock className="text-primary" />} label={label} value={format(date, "h:mm a")} />;
  } catch {
    return <DetailItem icon={<Clock className="text-primary" />} label={label} value={time} />; 
  }
};


export function CaseDetailSheet({ caseDetails, onClose, onUpdateStatus, isUpdatingStatus }: CaseDetailSheetProps) {
  const {
    id,
    patient_name,
    treating_surgeon,
    service_date,
    start_time,
    end_time,
    status,
    doctor_acc_no,
    weight,
    height,
    icd10_codes,
    procedure_codes,
    consultations,
    ortho_modifiers,
    procedures,
    modifiers,
    bp_start_time,
    bp_end_time,
    hospital_sticker_image_url,
    admission_form_image_url,
    notes,
    birth_weight,
    primary_assistant,
    secondary_assistant,
    referring_service_provider,
    referred_by_icd10,
    asa_level,
    submittedDateTime
  } = caseDetails;

  const formattedServiceDate = service_date ? format(parseISO(submittedDateTime), "MMMM d, yyyy") : "N/A"; 

  const hasHospitalSticker = hospital_sticker_image_url && hospital_sticker_image_url.trim() !== "";
  const hasAdmissionForm = admission_form_image_url && admission_form_image_url.trim() !== "";

  return (
    <ScrollArea className="h-full">
    <div className="flex flex-col h-full">
      <SheetHeader className="p-6 bg-muted/30 border-b">
        <SheetTitle className="text-2xl text-primary flex items-center">
          <FileText className="mr-3 h-7 w-7" /> Case Details
        </SheetTitle>
        <SheetDescription>
          Viewing case <span className="font-semibold text-foreground">ID: {id}</span> for patient <span className="font-semibold text-foreground">{patient_name}</span>.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-grow p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <DetailItem icon={<Hash className="text-primary" />} label="Case ID" value={id} />
          <DetailItem icon={<User className="text-primary" />} label="Patient Name" value={patient_name} />
          <DetailItem icon={<BriefcaseMedical className="text-primary" />} label="Treating Surgeon" value={formatNullableString(treating_surgeon)} />
          <DetailItem icon={<BriefcaseMedical className="text-primary" />} label="Doctor Acc No" value={formatNullableString(doctor_acc_no)} />
          <DetailItem icon={<CalendarDays className="text-primary" />} label="Service Date" value={formattedServiceDate} />
          <TimeDisplay label="Start Time" time={start_time} />
          <TimeDisplay label="End Time" time={end_time} />
          <DetailItem icon={<Weight className="text-primary" />} label="Weight (kg)" value={formatNullableNumber(weight)} />
          <DetailItem icon={<Ruler className="text-primary" />} label="Height (cm)" value={formatNullableNumber(height)} />
           {birth_weight !== null && birth_weight !== undefined && <DetailItem icon={<Thermometer className="text-primary" />} label="Birth Weight (kg)" value={formatNullableNumber(birth_weight)} />}
          <DetailItem icon={<Activity className="text-primary" />} label="ASA Level" value={formatNullableNumber(asa_level)} />
        </div>
        
        <Separator />
        <Section title="Codes & Procedures">
          <DetailItem icon={<ListChecks className="text-primary" />} label="ICD10 Codes" value={formatNullableArray(icd10_codes)} />
          <DetailItem icon={<ListChecks className="text-primary" />} label="Procedure Codes" value={formatNullableArray(procedure_codes)} />
          <DetailItem icon={<ListChecks className="text-primary" />} label="Consultations" value={formatNullableArray(consultations)} />
          <DetailItem icon={<ListChecks className="text-primary" />} label="Orthopedic Modifiers" value={formatNullableArray(ortho_modifiers)} />
          <DetailItem icon={<ListChecks className="text-primary" />} label="Procedures" value={formatNullableArray(procedures)} />
          <DetailItem icon={<ListChecks className="text-primary" />} label="Modifiers" value={formatNullableArray(modifiers)} />
          <DetailItem icon={<ListChecks className="text-primary" />} label="Referred by ICD10" value={formatNullableArray(referred_by_icd10)} />
        </Section>

        <Separator />
        <Section title="Assistants & Referrals">
          <DetailItem icon={<User className="text-primary" />} label="Primary Assistant" value={formatNullableString(primary_assistant)} />
          <DetailItem icon={<User className="text-primary" />} label="Secondary Assistant" value={formatNullableString(secondary_assistant)} />
          <DetailItem icon={<BriefcaseMedical className="text-primary" />} label="Referring Service Provider" value={formatNullableString(referring_service_provider)} />
        </Section>
        
        <Separator />
        <Section title="Blood Pressure Monitoring">
             <TimeDisplay label="BP Start Time" time={bp_start_time} />
             <TimeDisplay label="BP End Time" time={bp_end_time} />
        </Section>

        {notes && notes.trim() !== "" && (
          <>
            <Separator />
            <Section title="Notes">
              <div className="flex items-start space-x-3 py-2 col-span-full"> {/* Ensure notes take full width if needed */}
                <Edit3 className="text-primary flex-shrink-0 w-5 h-5 mt-0.5" />
                <p className="text-sm text-foreground whitespace-pre-wrap">{notes}</p>
              </div>
            </Section>
          </>
        )}
        
        {(hasHospitalSticker || hasAdmissionForm) && (
          <>
            <Separator />
            <Section title="Attached Images">
              {hasHospitalSticker && <ImageItem label="Hospital Sticker" url={hospital_sticker_image_url!} dataAiHint="hospital sticker"/>}
              {hasAdmissionForm && <ImageItem label="Admission Form" url={admission_form_image_url!} dataAiHint="admission form" />}
            </Section>
          </>
        )}

        <Separator />

        <div>
          <h4 className="text-md font-semibold mb-2 text-foreground flex items-center">
            <Tag className="mr-2 h-5 w-5 text-primary" /> Case Status
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
      </div>

      <SheetFooter className="p-6 border-t bg-muted/30 mt-auto sticky bottom-0">
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
  className?: string;
}

const DetailItem: React.FC<DetailItemProps> = ({ icon, label, value, className }) => (
  <div className={cn("flex items-start space-x-3 py-2", className)}>
    <div className="flex-shrink-0 w-5 h-5 mt-0.5">{icon}</div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground break-words">{value}</p>
    </div>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h4 className="text-md font-semibold mb-1 text-primary">{title}</h4>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0">
        {children}
    </div>
  </div>
);

interface ImageItemProps {
  label: string;
  url: string;
  dataAiHint: string;
}

const ImageItem: React.FC<ImageItemProps> = ({ label, url, dataAiHint }) => {
  if (!url || url.trim() === "") return null; // Don't render if URL is empty

  return (
    <div className="py-2">
      <p className="text-xs text-muted-foreground flex items-center mb-1">
          <ImageIcon className="text-primary w-4 h-4 mr-2" />{label}
      </p>
      {url.startsWith('https://placehold.co') ? (
          <Image src={url} alt={label} width={300} height={200} className="rounded border shadow-sm" data-ai-hint={dataAiHint} />
      ) : (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline break-all">{url}</a>
      )}
    </div>
  );
};
