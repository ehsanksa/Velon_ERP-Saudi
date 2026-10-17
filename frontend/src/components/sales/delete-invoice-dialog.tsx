import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/locale-context';

type DeleteInvoiceDialogProps = {
  invoiceNumber: string | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteInvoiceDialog({
  invoiceNumber,
  pending,
  onCancel,
  onConfirm,
}: DeleteInvoiceDialogProps) {
  const t = useT();

  return (
    <AlertDialog
      open={Boolean(invoiceNumber)}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Delete this invoice?')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              'This removes {number}. Stock taken for this invoice is returned, and the invoice cannot be opened again.',
              { number: invoiceNumber ?? '' },
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t('Cancel')}</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? t('Deleting…') : t('Delete')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
