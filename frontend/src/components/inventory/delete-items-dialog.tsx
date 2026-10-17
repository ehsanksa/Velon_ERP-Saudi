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

type DeleteItemsDialogProps = {
  count: number;
  names: string[];
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteItemsDialog({
  count,
  names,
  pending,
  onCancel,
  onConfirm,
}: DeleteItemsDialogProps) {
  const t = useT();
  const open = count > 0;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {count === 1
              ? t('Delete this item?')
              : t('Delete {count} items?', { count: String(count) })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {names.slice(0, 5).join(', ')}
            {names.length > 5 ? ` +${names.length - 5}` : ''}
            {'. '}
            {t(
              'This removes the selected products or variants and their on-hand stock. Past invoices keep their saved line text.',
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
