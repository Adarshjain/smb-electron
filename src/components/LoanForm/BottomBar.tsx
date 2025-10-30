import { Button } from '@/components/ui/button';

export default function BottomBar(props: {
  isEditMode: boolean;
  onSaveClick: () => void;
  onLastClick: () => void;
  onPrevClick: () => void;
  onNextClick: () => void;
  onNewClick: () => void;
  onResetClick: () => void;
}) {
  return (
    <div className="flex gap-4 justify-center w-full fixed bottom-0 py-4 border-t bg-gray-100 border-gray-200">
      <Button variant="outline" size="lg" onClick={props.onResetClick}>
        Reset
      </Button>
      <Button variant="outline" size="lg" onClick={props.onNewClick}>
        New
      </Button>
      <Button size="lg" onClick={props.onSaveClick}>
        {props.isEditMode ? 'Save' : 'Create'}
      </Button>
    </div>
  );
}
