import {
  useListLandDocuments,
  useCreateLandDocument,
  useUpdateLandDocument,
  useDeleteLandDocument,
  getListLandDocumentsQueryKey,
  useListCompanies,
  useListLandParcels,
  type LandDocument,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumLabel, enumOptions } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function LandDocumentsPage() {
  const { language } = useLanguage();
  const DOC_TYPE = enumOptions(["deed", "survey", "permit", "valuation", "contract", "other"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: parcelIdData } = useListLandParcels({ pageSize: 200 });
  const parcelIdOptions = (parcelIdData?.data ?? []).map((x) => ({ value: x.id, label: x.name, labelAr: x.nameAr ?? x.name }));

  const fields: ResourceField[] = [
    { name: "parcelId", label: "Parcel", labelAr: "القطعة", type: "select", required: true, options: parcelIdOptions },
    { name: "docType", label: "Document Type", labelAr: "نوع المستند", type: "select", options: DOC_TYPE },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "titleAr", label: "Title (Arabic)", labelAr: "العنوان بالعربية", rtl: true },
    { name: "fileUrl", label: "File URL", labelAr: "رابط الملف" },
    { name: "issueDate", label: "Issue Date", labelAr: "تاريخ الإصدار", type: "date" },
    { name: "expiryDate", label: "Expiry Date", labelAr: "تاريخ الانتهاء", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<LandDocument>[] = [
    { header: "Title", headerAr: "العنوان", render: (r) => language === "ar" ? (r.titleAr ?? r.title) : r.title },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.docType, language)}</Badge> },
    { header: "Issue Date", headerAr: "تاريخ الإصدار", render: (r) => r.issueDate ?? "-" },
    { header: "Expiry Date", headerAr: "تاريخ الانتهاء", render: (r) => r.expiryDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Land Documents"
      titleAr="مستندات الأراضي"
      columns={columns}
      fields={fields}
      useList={useListLandDocuments}
      useCreate={useCreateLandDocument}
      useUpdate={useUpdateLandDocument}
      useDelete={useDeleteLandDocument}
      getListQueryKey={getListLandDocumentsQueryKey}
      companyId={companyId}
    />
  );
}
