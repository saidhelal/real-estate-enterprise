import { useState } from "react";
import {
  useCreateReservation,
  useListCustomers,
  getListCustomersQueryKey,
  useListCrmAvailableUnits,
  getListCrmAvailableUnitsQueryKey,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { enumOptions } from "@/lib/enums";

export type DialogFieldType = "text" | "textarea" | "date" | "number" | "money" | "select";

export interface DialogField {
  name: string;
  label: string;
  type?: DialogFieldType;
  required?: boolean;
  rtl?: boolean;
  options?: { value: string; label: string; labelAr?: string }[];
  defaultValue?: string;
}

const NONE = "__none__";

/**
 * Generic create/edit dialog. The caller performs the mutation inside onSubmit
 * and calls the provided `close` callback on success.
 */
export function ActionDialog({
  trigger,
  title,
  fields,
  description,
  submitLabel,
  isPending,
  onSubmit,
}: {
  trigger: React.ReactNode;
  title: string;
  fields: DialogField[];
  description?: React.ReactNode;
  submitLabel?: string;
  isPending?: boolean;
  onSubmit: (values: Record<string, string>, close: () => void) => void;
}) {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const initial: Record<string, string> = {};
  for (const f of fields) initial[f.name] = f.defaultValue ?? "";
  const [values, setValues] = useState<Record<string, string>>(initial);

  const reset = () => {
    const next: Record<string, string> = {};
    for (const f of fields) next[f.name] = f.defaultValue ?? "";
    setValues(next);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const setValue = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v === "" || v === NONE) continue;
      payload[k] = v;
    }
    onSubmit(payload, close);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((f) => (
            <div key={f.name} className="space-y-2">
              <Label>
                {f.label}
                {f.required && <span className="text-destructive"> *</span>}
              </Label>
              {f.type === "textarea" ? (
                <Textarea
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValue(f.name, e.target.value)}
                  required={f.required}
                  dir={f.rtl ? "rtl" : undefined}
                />
              ) : f.type === "select" ? (
                <Select
                  value={values[f.name] || (f.required ? "" : NONE)}
                  onValueChange={(v) => setValue(f.name, v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={f.label} />
                  </SelectTrigger>
                  <SelectContent>
                    {!f.required && <SelectItem value={NONE}>—</SelectItem>}
                    {(f.options ?? []).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {language === "ar" && o.labelAr ? o.labelAr : o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={
                    f.type === "number" || f.type === "money"
                      ? "number"
                      : f.type === "date"
                        ? "date"
                        : "text"
                  }
                  step={f.type === "money" ? "0.01" : undefined}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValue(f.name, e.target.value)}
                  required={f.required}
                  dir={f.rtl ? "rtl" : undefined}
                />
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {submitLabel ?? t("common.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Reservation dialog reused from the customer profile (unit picker) and the
 * available-units page (customer picker). One side may be fixed.
 */
export function ReservationDialog({
  companyId,
  fixedCustomer,
  fixedUnit,
  trigger,
  onCreated,
}: {
  companyId?: string;
  fixedCustomer?: { id: string; label: string };
  fixedUnit?: { id: string; label: string };
  trigger: React.ReactNode;
  onCreated: () => void;
}) {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const createReservation = useCreateReservation();

  const { data: customers } = useListCustomers(
    { pageSize: 200 },
    {
      query: {
        enabled: !fixedCustomer,
        queryKey: getListCustomersQueryKey({ pageSize: 200 }),
      },
    },
  );
  const unitParams = { companyId, pageSize: 200 };
  const { data: units } = useListCrmAvailableUnits(unitParams, {
    query: {
      enabled: !fixedUnit && !!companyId,
      queryKey: getListCrmAvailableUnitsQueryKey(unitParams),
    },
  });

  const customerOptions = fixedCustomer
    ? [{ value: fixedCustomer.id, label: fixedCustomer.label }]
    : (customers?.data ?? []).map((c) => ({
        value: c.id,
        label: language === "ar" ? c.nameAr ?? c.fullName : c.fullName,
      }));
  const unitOptions = fixedUnit
    ? [{ value: fixedUnit.id, label: fixedUnit.label }]
    : (units?.data ?? []).map((u) => ({
        value: u.id,
        label: `${u.code} — ${language === "ar" ? u.nameAr ?? u.name : u.name}`,
      }));

  const fields: DialogField[] = [
    { name: "code", label: t("crm.reservation.code"), required: true },
    {
      name: "customerId",
      label: t("crm.customer"),
      type: "select",
      required: true,
      options: customerOptions,
      defaultValue: fixedCustomer?.id,
    },
    {
      name: "unitId",
      label: t("crm.reservation.unit"),
      type: "select",
      required: true,
      options: unitOptions,
      defaultValue: fixedUnit?.id,
    },
    { name: "reservationDate", label: t("crm.reservation.date"), type: "date", required: true, defaultValue: today() },
    { name: "expiryDate", label: t("crm.reservation.expiry"), type: "date" },
    { name: "amount", label: t("common.amount"), type: "money" },
    {
      name: "status",
      label: t("common.status"),
      type: "select",
      options: enumOptions(["active", "converted", "cancelled", "expired"]),
      defaultValue: "active",
    },
    { name: "notes", label: t("crm.reservation.notes"), type: "textarea" },
  ];

  return (
    <ActionDialog
      trigger={trigger}
      title={t("crm.reservation.create_title")}
      fields={fields}
      isPending={createReservation.isPending}
      onSubmit={(values, close) => {
        if (!companyId) {
          toast({ title: t("common.error"), variant: "destructive" });
          return;
        }
        createReservation.mutate(
          {
            data: {
              companyId,
              code: values.code,
              customerId: fixedCustomer?.id ?? values.customerId,
              unitId: fixedUnit?.id ?? values.unitId,
              reservationDate: values.reservationDate,
              expiryDate: values.expiryDate,
              amount: values.amount,
              status: values.status,
              notes: values.notes,
            },
          },
          {
            onSuccess: () => {
              toast({ title: t("common.created") });
              onCreated();
              close();
            },
            onError: () => toast({ title: t("common.error"), variant: "destructive" }),
          },
        );
      }}
    />
  );
}
