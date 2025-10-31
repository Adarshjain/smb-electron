import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export interface ConfirmationDialogProps {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => Promise<void> | void;
  onCancel?: () => void;
  trigger?: React.ReactNode;
  isDestructive?: boolean;
  isOpen?: boolean;
  onChange?: (value: boolean) => void;
  children?: React.ReactNode;
}
export default function ConfirmationDialog(props: ConfirmationDialogProps) {
  return (
    <AlertDialog open={props.isOpen} onOpenChange={props.onChange}>
      <AlertDialogTrigger asChild>{props.trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{props.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {props.description ?? ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {props.children}
        <AlertDialogFooter>
          <AlertDialogCancel>{props.cancelText ?? 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction
            className={
              props.isDestructive
                ? 'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20'
                : ''
            }
            onClick={() => void props.onConfirm()}
          >
            {props.confirmText ?? 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
