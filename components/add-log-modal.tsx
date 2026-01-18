"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CorrectiveActionRecord } from "@/lib/types";
import { X, Save } from "lucide-react";

interface AddLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (record: CorrectiveActionRecord) => void;
  newCarNumber: string;
}

export function AddLogModal({ open, onOpenChange, onSave, newCarNumber }: AddLogModalProps) {
  const [formData, setFormData] = useState<Partial<CorrectiveActionRecord>>({
    internalCarNumber: newCarNumber,
    status: "Open",
    receivedDate: new Date().toISOString().split('T')[0],
  });

  // Update CAR number when prop changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, internalCarNumber: newCarNumber }));
  }, [newCarNumber]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const record: CorrectiveActionRecord = {
      id: `local_${Date.now()}_${Math.random()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...formData,
    } as CorrectiveActionRecord;
    
    onSave(record);
    onOpenChange(false);
    
    // Reset form
    setFormData({
      internalCarNumber: newCarNumber,
      status: "Open",
      receivedDate: new Date().toISOString().split('T')[0],
    });
  };

  const formFields = [
    { label: "Internal CAR #", field: "internalCarNumber", disabled: true },
    { label: "Location", field: "location" },
    { label: "Status", field: "status" },
    { label: "Incidence Type", field: "incidenceType" },
    { label: "Type", field: "type" },
    { label: "Category", field: "category" },
    { label: "Received Date", field: "receivedDate", type: "date" },
    { label: "Part Number", field: "partNumber" },
    { label: "Part Description", field: "partDescription" },
    { label: "Part Family", field: "partFamily" },
    { label: "Customer CAR #", field: "customerCarNumber" },
    { label: "Stop Tag #", field: "stopTagNumber" },
    { label: "Audit NC #", field: "auditNcNumber" },
    { label: "Customer", field: "customer" },
    { label: "Komatsu Tracking", field: "komatsuTracking" },
    { label: "Work Order #", field: "workOrderNumber" },
    { label: "Manufacture Date", field: "manufactureDate", type: "date" },
    { label: "Quantity", field: "quantity", type: "number" },
    { label: "Problem Description", field: "problemDescription", multiline: true },
    { label: "Department Responsible", field: "departmentResponsible" },
    { label: "Defect Category", field: "defectCategory" },
    { label: "Champion", field: "champion" },
    { label: "Containment Complete?", field: "containmentComplete" },
    { label: "Corrective Action Prevention", field: "correctiveActionPrevention", multiline: true },
    { label: "Corrective Action Detection", field: "correctiveActionDetection", multiline: true },
    { label: "Proposed Cost", field: "proposedCost", type: "number" },
    { label: "Cost Approved?", field: "costApproved" },
    { label: "Initial Resp.", field: "initialResp" },
    { label: "Final Resp. Due Date", field: "finalRespDueDate", type: "date" },
    { label: "Completed Resp. Actual", field: "completedRespActual", type: "date" },
    { label: "# Days to Close", field: "daysToClose", type: "number" },
    { label: "Closed Date", field: "closedDate", type: "date" },
    { label: "Employee ID", field: "employeeId" },
    { label: "RMA #", field: "rmaNumber" },
    { label: "Contact", field: "followUpContact" },
    { label: "Debit Cost", field: "followUpDebitCost", type: "number" },
    { label: "Comments", field: "followUpComments", multiline: true },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-2xl font-bold text-gray-800 flex items-center justify-between">
            <span>Add New Corrective Action Log</span>
            <button
              onClick={() => onOpenChange(false)}
              className="hover:bg-gray-100 rounded p-1"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto py-6 px-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {formFields.map(({ label, field, type, disabled, multiline }) => (
              <div key={field} className={multiline ? "md:col-span-2" : ""}>
                <Label htmlFor={field} className="text-sm font-semibold text-gray-700 mb-2 block">
                  {label}
                </Label>
                {multiline ? (
                  <textarea
                    id={field}
                    value={(formData as any)[field] || ""}
                    onChange={(e) => handleChange(field, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] text-sm"
                    placeholder={`Enter ${label.toLowerCase()}...`}
                  />
                ) : (
                  <Input
                    id={field}
                    type={type || "text"}
                    value={(formData as any)[field] || ""}
                    onChange={(e) => handleChange(field, type === "number" ? parseFloat(e.target.value) || "" : e.target.value)}
                    disabled={disabled}
                    className="text-sm"
                    placeholder={`Enter ${label.toLowerCase()}...`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-4 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="px-6"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-gradient-to-r from-green-600 to-teal-600 text-white hover:from-green-700 hover:to-teal-700 px-6"
          >
            <Save className="h-4 w-4 mr-2" />
            Save to Main
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

