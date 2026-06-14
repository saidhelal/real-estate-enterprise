import { useState } from "react";
import { useLanguage } from "@/lib/language-provider";
import { 
  useListNumberSequences, 
  useCreateNumberSequence, 
  useUpdateNumberSequence, 
  useDeleteNumberSequence,
  getListNumberSequencesQueryKey,
  NumberSequenceInput,
  NumberSequence
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function NumberSequencesPage() {
  const { t } = useLanguage();
  const { data: sequences, isLoading } = useListNumberSequences();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState<NumberSequence | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteNumberSequence();

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this sequence?")) {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            toast({ title: "Sequence deleted" });
            queryClient.invalidateQueries({ queryKey: getListNumberSequencesQueryKey() });
          },
          onError: () => {
            toast({ title: "Failed to delete sequence", variant: "destructive" });
          }
        }
      );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">{t("number_sequences.title")}</h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("number_sequences.create")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("number_sequences.create")}</DialogTitle>
            </DialogHeader>
            <SequenceForm onSuccess={() => setIsCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Next</TableHead>
              <TableHead>Sample</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">Loading...</TableCell>
              </TableRow>
            ) : sequences?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">No sequences found</TableCell>
              </TableRow>
            ) : (
              sequences?.map((seq) => (
                <TableRow key={seq.id}>
                  <TableCell className="font-medium">{seq.documentType}</TableCell>
                  <TableCell>{seq.prefix}</TableCell>
                  <TableCell>{seq.nextNumber}</TableCell>
                  <TableCell className="font-mono text-xs bg-muted px-2 py-1 rounded w-fit">{seq.sample}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => setEditingSequence(seq)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(seq.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingSequence} onOpenChange={(open) => !open && setEditingSequence(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sequence</DialogTitle>
          </DialogHeader>
          {editingSequence && (
            <SequenceForm 
              sequence={editingSequence} 
              onSuccess={() => setEditingSequence(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SequenceForm({ sequence, onSuccess }: { sequence?: NumberSequence; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateNumberSequence();
  const updateMutation = useUpdateNumberSequence();
  
  const [formData, setFormData] = useState({
    documentType: sequence?.documentType || "",
    prefix: sequence?.prefix || "",
    nextNumber: sequence?.nextNumber || 1,
    padding: sequence?.padding || 5,
    resetYearly: sequence?.resetYearly || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sequence) {
      updateMutation.mutate(
        { id: sequence.id, data: formData },
        {
          onSuccess: () => {
            toast({ title: "Sequence updated" });
            queryClient.invalidateQueries({ queryKey: getListNumberSequencesQueryKey() });
            onSuccess();
          }
        }
      );
    } else {
      createMutation.mutate(
        { data: formData as NumberSequenceInput },
        {
          onSuccess: () => {
            toast({ title: "Sequence created" });
            queryClient.invalidateQueries({ queryKey: getListNumberSequencesQueryKey() });
            onSuccess();
          }
        }
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Document Type</Label>
        <Input 
          value={formData.documentType} 
          onChange={(e) => setFormData({...formData, documentType: e.target.value})} 
          required 
          disabled={!!sequence}
        />
      </div>
      <div className="space-y-2">
        <Label>Prefix (e.g. INV-)</Label>
        <Input 
          value={formData.prefix} 
          onChange={(e) => setFormData({...formData, prefix: e.target.value})} 
          required 
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Next Number</Label>
          <Input 
            type="number"
            value={formData.nextNumber} 
            onChange={(e) => setFormData({...formData, nextNumber: parseInt(e.target.value)})} 
            required 
          />
        </div>
        <div className="space-y-2">
          <Label>Padding</Label>
          <Input 
            type="number"
            value={formData.padding} 
            onChange={(e) => setFormData({...formData, padding: parseInt(e.target.value)})} 
            required 
            min={1}
            max={10}
          />
        </div>
      </div>
      <div className="flex items-center space-x-2 pt-2">
        <Checkbox 
          id="resetYearly" 
          checked={formData.resetYearly} 
          onCheckedChange={(checked) => setFormData({...formData, resetYearly: !!checked})}
        />
        <label htmlFor="resetYearly" className="text-sm">Reset counter yearly</label>
      </div>
      
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>Cancel</Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {sequence ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
