import {
  useListDrawingRevisions,
  useCreateDrawingRevision,
  useUpdateDrawingRevision,
  useDeleteDrawingRevision,
  getListDrawingRevisionsQueryKey,
  useListDrawings,
  useListCompanies,
  type DrawingRevision,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { Badge } from "@/components/ui/badge";

export default function DrawingRevisionsPage() {
  const { language } = useLanguage();
  const { options: STATUS } = useLookupOptions("submittal_status", ["draft", "submitted", "approved", "rejected", "superseded"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: drawingData } = useListDrawings({ pageSize: 200 });
  const drawingOptions = (drawingData?.data ?? []).map((o) => ({ value: o.id, label: o.title }));

  const fields: ResourceField[] = [
    { name: "drawingId", label: "Drawing", labelAr: "الرسم", type: "select", required: true, options: drawingOptions },
    { name: "versionNumber", label: "Version Number", labelAr: "رقم الإصدار", required: true },
    { name: "revisionDate", label: "Revision Date", labelAr: "تاريخ المراجعة", type: "date" },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: STATUS },
    { name: "revisedBy", label: "Revised By", labelAr: "بواسطة" },
    { name: "fileReference", label: "File Reference", labelAr: "مرجع الملف" },
  ];

  const columns: ResourceColumn<DrawingRevision>[] = [
    { header: "Version Number", headerAr: "رقم الإصدار", render: (r) => <span className="font-medium">{r.versionNumber ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Revision Date", headerAr: "تاريخ المراجعة", render: (r) => r.revisionDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Drawing Revisions"
      titleAr="مراجعات الرسومات"
      columns={columns}
      fields={fields}
      useList={useListDrawingRevisions}
      useCreate={useCreateDrawingRevision}
      useUpdate={useUpdateDrawingRevision}
      useDelete={useDeleteDrawingRevision}
      getListQueryKey={getListDrawingRevisionsQueryKey}
      companyId={companyId}
    />
  );
}
